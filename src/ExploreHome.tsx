import React, { useEffect, useRef, useState } from 'react';
import {Text, TextInput, View} from './i18n/components';
import {useLanguage} from './i18n/LanguageProvider';
import ContentLanguageGate from './i18n/ContentLanguageGate';
import {matchesSearch} from '../shared/search';
import {
  ActivityIndicator,
  Animated,
  BackHandler,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Bookmark,
  Check,
  ChevronRight,
  Clock3,
  Code2,
  GraduationCap,
  Landmark,
  Languages,
  Layers,
  Search,
  User,
  X,
  type LucideIcon,
} from 'lucide-react-native';
import { getCatalog } from './api';
import {
  categoryColumns,
  collectCourseIds,
  resolvePath,
  searchCatalog,
  type Catalog,
  type CatalogNode,
  type Course,
} from './catalog';
import { useLearningLibrary } from './useLearningLibrary';

export interface LearnerIdentity {
  id: string;
  name: string;
}
interface Props {
  user?: LearnerIdentity | null;
  onAccountPress: () => void;
}
type LibraryView = 'explore' | 'saved' | 'recent';

const palette = {
  ink: '#20322E',
  muted: '#64736D',
  green: '#24745A',
  line: '#E2E9E4',
  paper: '#F8FAF8',
  white: '#FFFFFF',
  tint: '#EBF3EE',
};
const categoryVisuals: Record<
  string,
  { icon: LucideIcon; tint: string; ink: string }
> = {
  english: { icon: Languages, tint: '#E8F1EB', ink: '#2A7256' },
  schools: { icon: BookOpen, tint: '#E9EFF8', ink: '#496A9D' },
  government: { icon: Landmark, tint: '#FBEEE8', ink: '#A8573D' },
  colleges: { icon: GraduationCap, tint: '#F2EBF5', ink: '#79558E' },
  computers: { icon: Code2, tint: '#F8F1D9', ink: '#8E742A' },
};
const fallbackVisual = { icon: Layers, tint: palette.tint, ink: palette.green };

function IconButton({
  label,
  icon: Icon,
  onPress,
  selected = false,
  disabled = false,
}: {
  label: string;
  icon: LucideIcon;
  onPress: () => void;
  selected?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
    >
      <Icon
        size={20}
        color={selected ? palette.green : palette.ink}
        fill={selected ? '#D8EADC' : 'none'}
      />
    </Pressable>
  );
}

function SectionTitle({ title, label }: { title: string; label?: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text accessibilityRole="header" style={styles.sectionTitle}>
        {title}
      </Text>
      {label && <Text style={styles.overline}>{label}</Text>}
    </View>
  );
}

function CategoryCard({
  entry,
  width,
  onPress,
}: {
  entry: CatalogNode;
  width: number;
  onPress: () => void;
}) {
  const {t} = useLanguage();
  const visual = categoryVisuals[entry.id] ?? fallbackVisual;
  const Icon = visual.icon;
  const scale = useRef(new Animated.Value(1)).current;
  const [hovered, setHovered] = useState(false);
  const animate = (value: number) =>
    Animated.timing(scale, {
      toValue: value,
      duration: 110,
      useNativeDriver: true,
    }).start();
  return (
    <Animated.View style={{ width, transform: [{ scale }] }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Explore ${entry.title}`}
        onPress={onPress}
        onPressIn={() => animate(0.98)}
        onPressOut={() => animate(1)}
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        style={[styles.categoryCard, hovered && styles.categoryHovered]}
      >
        <View style={[styles.categoryIcon, { backgroundColor: visual.tint }]}>
          <Icon size={25} strokeWidth={1.7} color={visual.ink} />
        </View>
        <Text style={styles.categoryTitle}>{t(`ui.${entry.id}`,{defaultValue:entry.title})}</Text>
        <Text style={styles.categoryDescription}>{entry.description}</Text>
        <View style={styles.categoryAction}>
          <Text style={[styles.exploreLabel, { color: visual.ink }]}>
            Explore
          </Text>
          <ArrowRight size={16} color={visual.ink} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

function CourseCard({
  course,
  category,
  saved,
  ready,
  onOpen,
  onSave,
  note,
}: {
  course: Course;
  category?: string;
  saved: boolean;
  ready: boolean;
  onOpen: () => void;
  onSave: () => void;
  note?: string;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  return (
    <View style={styles.courseCard}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${course.title}`}
        onPress={onOpen}
        style={({ pressed }) => pressed && styles.pressed}
      >
        {imageFailed ? (
          <View style={[styles.courseImage, styles.imageFallback]}>
            <BookOpen size={36} color={palette.green} />
          </View>
        ) : (
          <Image
            source={{ uri: course.imageUrl }}
            accessibilityLabel={course.title}
            onError={() => setImageFailed(true)}
            style={styles.courseImage}
          />
        )}
        <View style={styles.courseBody}>
          <Text style={styles.courseCategory}>{category}</Text>
          <Text style={styles.courseTitle}>{course.title}</Text>
          <Text numberOfLines={2} style={styles.courseSummary}>
            {course.summary}
          </Text>
          <Text style={styles.courseLevel}>
            {course.level} · Course preview
          </Text>
          {note && <Text style={styles.resumeNote}>{note}</Text>}
        </View>
      </Pressable>
      <View style={styles.courseFooter}>
        <Text style={styles.previewLabel}>PREVIEW</Text>
        <IconButton
          label={`${saved ? 'Unsave' : 'Save'} ${course.title}`}
          icon={Bookmark}
          selected={saved}
          disabled={!ready}
          onPress={onSave}
        />
      </View>
    </View>
  );
}

export default function ExploreHome({ user = null, onAccountPress }: Props) {
  const {language,t} = useLanguage();
  const { width } = useWindowDimensions();
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [request, setRequest] = useState(0);
  const [query, setQuery] = useState('');
  const [path, setPath] = useState<string[]>([]);
  const [view, setView] = useState<LibraryView>('explore');
  const [courseId, setCourseId] = useState<string | null>(null);
  const [level, setLevel] = useState('All levels');
  const [resource, setResource] = useState<string | null>(null);
  const [unit, setUnit] = useState<string | null>(null);
  const [resultLimit, setResultLimit] = useState(12);
  const {
    library,
    ready,
    storageError,
    toggleSaved,
    recordView,
    recordResource,
  } = useLearningLibrary(user?.id);
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const contentWidth = Math.min(width, 1520) - 40;
  const columns = categoryColumns(width);
  const cardWidth = (contentWidth - (columns - 1) * 12) / columns;

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const timeout = setTimeout(() => controller.abort(), 8000);
    setLoading(true);
    setError(false);
    getCatalog(controller.signal,language.locale,request>0)
      .then(result => {
        if (active) {
          setCatalog(result);
        }
      })
      .catch(() => {
        if (active) {
          setError(true);
        }
      })
      .finally(() => {
        clearTimeout(timeout);
        if (active) {
          setLoading(false);
        }
      });
    return () => {
      active = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [request,language.locale]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        if (courseId) {
          setCourseId(null);
          setResource(null);
          setUnit(null);
        } else if (query) {
          setQuery('');
        } else if (path.length) {
          setPath(previous => previous.slice(0, -1));
        } else if (view !== 'explore') {
          setView('explore');
        } else {
          return false;
        }
        return true;
      },
    );
    return () => subscription.remove();
  }, [courseId, path, query, view]);

  useEffect(() => {
    scroll.current?.scrollTo({ y: 0, animated: false });
  }, [path, courseId, view]);

  const nodes = resolvePath(catalog?.categories ?? [], path);
  const current = nodes.at(-1);
  const selectedCourse = catalog?.courses.find(
    course => course.id === courseId,
  );
  const categoryName = (id: string) =>
    catalog?.categories.find(category => category.id === id)?.title;
  const coursesById = (ids: string[]) =>
    ids.flatMap(id => catalog?.courses.find(course => course.id === id) ?? []);
  const openCourse = (course: Course) => {
    setCourseId(course.id);
    setQuery('');
    setUnit(null);
    setResource(library.lastOpened[course.id] ?? null);
    recordView(course.id);
  };
  const navigate = (nextPath: string[], entry: CatalogNode) => {
    setPath(nextPath);
    setQuery('');
    setView('explore');
    setLevel('All levels');
    const course = catalog?.courses.find(item => item.id === entry.courseId);
    if (course) {
      openCourse(course);
    } else {
      setCourseId(null);
    }
  };
  const selectResource = (value: string) => {
    setResource(value);
    if (selectedCourse) {
      recordResource(selectedCourse.id, value);
    }
  };
  const courseGrid = (
    courses: Course[],
    emptyMessage = 'No courses match this filter.',
  ) =>
    courses.length ? (
      <View style={styles.courseGrid}>
        {courses.map(course => (
          <View
            key={course.id}
            style={{
              width:
                width < 600
                  ? contentWidth
                  : (contentWidth - (Math.min(columns, 3) - 1) * 16) /
                    Math.min(columns, 3),
            }}
          >
            <CourseCard
              course={course}
              category={categoryName(course.categoryId)}
              saved={library.saved.includes(course.id)}
              ready={ready}
              onOpen={() => openCourse(course)}
              onSave={() => toggleSaved(course.id)}
              note={
                user && library.lastOpened[course.id]
                  ? `Last opened: ${library.lastOpened[course.id]}`
                  : undefined
              }
            />
          </View>
        ))}
      </View>
    ) : (
      <View style={styles.emptyState}>
        <BookOpen size={28} color={palette.muted} />
        <Text style={styles.emptyText}>{emptyMessage}</Text>
      </View>
    );
  const matchesLevel = (course: Course) =>
    level === 'All levels' || course.level === level;
  const levelFilter = (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.filterRow}
    >
      {['All levels', 'Beginner', 'Intermediate', 'Advanced'].map(item => (
        <Pressable
          key={item}
          accessibilityRole="tab"
          accessibilityLabel={`Filter ${item}`}
          accessibilityState={{ selected: level === item }}
          onPress={() => setLevel(item)}
          style={[styles.filter, level === item && styles.filterSelected]}
        >
          <Text
            style={[
              styles.filterText,
              level === item && styles.filterTextSelected,
            ]}
          >
            {item}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
  const searchResults = searchCatalog(catalog?.categories ?? [], query);
  const searchCourses = catalog?.courses.filter(course => matchesSearch(`${course.title} ${course.summary} ${categoryName(course.categoryId)}`,query) && matchesLevel(course)) ?? [];
  const scopedIds = current ? collectCourseIds(current) : new Set<string>();
  const scopedCourses =
    catalog?.courses.filter(
      course => scopedIds.has(course.id) && matchesLevel(course),
    ) ?? [];
  const resourceFormats = selectedCourse?.resources ?? current?.formats ?? [];

  return (
    <ScrollView
      ref={scroll}
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Explore home"
          onPress={() => {
            setPath([]);
            setCourseId(null);
            setQuery('');
            setView('explore');
            setLevel('All levels');
          }}
          style={styles.logo}
        >
          <Image
            source={require('../assets/brand/logo.png')}
            accessibilityLabel="bharatshiksak logo"
            resizeMode="contain"
            style={styles.logoIcon}
          />
          <Text style={styles.brand} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65}>
            bharatshiksak
          </Text>
        </Pressable>
        <IconButton label="Open profile" icon={User} onPress={onAccountPress} />
      </View>
      {!current && !selectedCourse && view === 'explore' && !query && (
        <View style={styles.welcome}>
          <Text style={styles.overline}>
            {user
              ? `WELCOME BACK, ${user.name.split(' ')[0].toUpperCase()}`
              : 'A WORLD OF LEARNING'}
          </Text>
          <Text accessibilityRole="header" style={styles.welcomeTitle}>
            {t('ui.homeTitle')}
          </Text>
        </View>
      )}
      <View style={styles.searchBox}>
        <Search size={20} color={palette.muted} />
        <TextInput
          accessibilityLabel="Search categories and courses"
          placeholder="What do you want to learn today?"
          placeholderTextColor={palette.muted}
          style={styles.searchInput}
          value={query}
          onChangeText={value => {
            setQuery(value);
            setCourseId(null);
            setResultLimit(12);
          }}
          returnKeyType="search"
        />
        {!!query && (
          <IconButton
            label="Clear search"
            icon={X}
            onPress={() => setQuery('')}
          />
        )}
      </View>
      <View accessibilityRole="tablist" style={styles.libraryTabs}>
        {(
          [
            { id: 'explore', title: 'Explore', icon: Layers },
            { id: 'saved', title: 'Saved', icon: Bookmark },
            { id: 'recent', title: 'Recent', icon: Clock3 },
          ] as const
        ).map(tab => (
          <Pressable
            key={tab.id}
            accessibilityRole="tab"
            accessibilityLabel={`${tab.title} courses`}
            accessibilityState={{ selected: view === tab.id }}
            onPress={() => {
              setView(tab.id);
              setPath([]);
              setCourseId(null);
              setQuery('');
              setLevel('All levels');
            }}
            style={[
              styles.libraryTab,
              view === tab.id && styles.libraryTabSelected,
            ]}
          >
            <tab.icon
              size={16}
              color={view === tab.id ? palette.green : palette.muted}
            />
            <Text
              style={[
                styles.tabText,
                view === tab.id && styles.selectedTabText,
              ]}
            >
              {tab.title}
            </Text>
          </Pressable>
        ))}
      </View>
      {storageError && (
        <Text accessibilityRole="alert" style={styles.warning}>
          Device storage is unavailable. Changes may not survive an app restart.
        </Text>
      )}
      {loading ? (
        <View style={styles.state}>
          <ActivityIndicator
            accessibilityLabel="Loading catalog"
            color={palette.green}
          />
          <Text style={styles.muted}>Loading your learning catalog...</Text>
        </View>
      ) : error ? (
        <View style={styles.state}>
          <Text accessibilityRole="alert" style={styles.emptyText}>
            We couldn't load the learning catalog.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retry catalog"
            onPress={() => setRequest(previous => previous + 1)}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonText}>Try again</Text>
            <ArrowRight size={17} color="#FFFFFF" />
          </Pressable>
        </View>
      ) : (
        catalog && (
          <>
            {selectedCourse ? (
              <>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Back to browsing"
                  onPress={() => {
                    setCourseId(null);
                    setResource(null);
                    setUnit(null);
                  }}
                  style={styles.back}
                >
                  <ArrowLeft size={18} color={palette.green} />
                  <Text style={styles.link}>Back to browsing</Text>
                </Pressable>
                <View style={styles.previewHeader}>
                  <Text style={styles.overline}>
                    {categoryName(selectedCourse.categoryId)}
                  </Text>
                  <Text style={styles.previewStatus}>COURSE PREVIEW</Text>
                </View>
                <Text accessibilityRole="header" style={styles.pageTitle}>
                  {selectedCourse.title}
                </Text>
                <Text style={styles.pageDescription}>
                  {selectedCourse.summary}
                </Text>
                <View style={styles.detailMeta}>
                  <Text style={styles.levelLabel}>{selectedCourse.level}</Text>
                  <Pressable
                    disabled={!ready}
                    accessibilityRole="button"
                    accessibilityLabel={`${
                      library.saved.includes(selectedCourse.id)
                        ? 'Unsave'
                        : 'Save'
                    } course`}
                    accessibilityState={{
                      disabled: !ready,
                      selected: library.saved.includes(selectedCourse.id),
                    }}
                    onPress={() => toggleSaved(selectedCourse.id)}
                    style={styles.saveCourse}
                  >
                    <Bookmark
                      size={18}
                      color={palette.green}
                      fill={
                        library.saved.includes(selectedCourse.id)
                          ? '#D8EADC'
                          : 'none'
                      }
                    />
                    <Text style={styles.link}>
                      {library.saved.includes(selectedCourse.id)
                        ? 'Saved'
                        : 'Save course'}
                    </Text>
                  </Pressable>
                </View>
                <ContentLanguageGate contentId={selectedCourse.id} contentLanguage={selectedCourse.contentLanguage} onCancel={() => setCourseId(null)}>
                <SectionTitle title="Learning path" />
                {selectedCourse.units.map((title, index) => (
                  <Pressable
                    key={title}
                    accessibilityRole="button"
                    accessibilityLabel={`Preview ${title}`}
                    onPress={() => {
                      setUnit(title);
                      selectResource(resource ?? selectedCourse.resources[0]);
                    }}
                    style={[
                      styles.branchRow,
                      unit === title && styles.activeBranch,
                    ]}
                  >
                    <Text style={styles.unitNumber}>
                      {String(index + 1).padStart(2, '0')}
                    </Text>
                    <Text style={styles.branchTitle}>{title}</Text>
                    {unit === title ? (
                      <Check size={18} color={palette.green} />
                    ) : (
                      <ChevronRight size={18} color={palette.muted} />
                    )}
                  </Pressable>
                ))}
                <SectionTitle title="Learning resources" />
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.filterRow}
                >
                  {resourceFormats.map(format => (
                    <Pressable
                      key={format}
                      accessibilityRole="tab"
                      accessibilityLabel={`Resource ${format}`}
                      accessibilityState={{ selected: resource === format }}
                      onPress={() => selectResource(format)}
                      style={[
                        styles.filter,
                        resource === format && styles.filterSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.filterText,
                          resource === format && styles.filterTextSelected,
                        ]}
                      >
                        {format}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
                <View style={styles.resourcePreview}>
                  <BookOpen size={28} color={palette.green} />
                  <Text style={styles.sectionTitle}>
                    {unit ?? resource ?? 'Course preview'}
                  </Text>
                  <Text style={styles.emptyText}>
                    {resource
                      ? `${resource} content has not been published yet.`
                      : 'Lesson content has not been published yet.'}
                  </Text>
                </View>
                </ContentLanguageGate>
              </>
            ) : query.trim() ? (
              <>
                <SectionTitle title="Search results" />
                {levelFilter}
                {searchResults.slice(0, resultLimit).map(match => (
                  <Pressable
                    key={match.node.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Browse ${match.node.title}`}
                    onPress={() => navigate(match.path, match.node)}
                    style={styles.branchRow}
                  >
                    <View style={styles.flex}>
                      <Text style={styles.branchTitle}>{match.node.title}</Text>
                      {!!match.trail && (
                        <Text numberOfLines={2} style={styles.breadcrumbText}>
                          {match.trail}
                        </Text>
                      )}
                    </View>
                    <ChevronRight size={18} color={palette.muted} />
                  </Pressable>
                ))}
                {searchResults.length > resultLimit && (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setResultLimit(previous => previous + 12)}
                    style={styles.back}
                  >
                    <Text style={styles.link}>Show more results</Text>
                    <ArrowRight size={16} color={palette.green} />
                  </Pressable>
                )}
                <SectionTitle title="Courses" />
                {courseGrid(
                  searchCourses,
                  searchResults.length
                    ? 'No course previews match your search and filter.'
                    : 'No results. Try a different subject or course.',
                )}
              </>
            ) : view !== 'explore' ? (
              <>
                <SectionTitle
                  title={view === 'saved' ? 'Saved courses' : 'Recently viewed'}
                  label="ON THIS DEVICE"
                />
                {levelFilter}
                {!ready ? (
                  <ActivityIndicator
                    accessibilityLabel="Loading library"
                    color={palette.green}
                  />
                ) : (
                  courseGrid(
                    coursesById(
                      view === 'saved' ? library.saved : library.recent,
                    ).filter(matchesLevel),
                    view === 'saved'
                      ? 'No saved courses match. Bookmark a course to keep it here.'
                      : 'No recently viewed courses match. Explore a course to begin.',
                  )
                )}
              </>
            ) : current ? (
              <>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.breadcrumbs}
                >
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="All categories"
                    onPress={() => setPath([])}
                  >
                    <Text style={styles.link}>Explore</Text>
                  </Pressable>
                  {nodes.map((entry, index) => (
                    <View key={entry.id} style={styles.breadcrumbItem}>
                      <ChevronRight size={13} color={palette.muted} />
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => setPath(path.slice(0, index + 1))}
                      >
                        <Text style={styles.breadcrumbText}>{entry.title}</Text>
                      </Pressable>
                    </View>
                  ))}
                </ScrollView>
                <Text accessibilityRole="header" style={styles.pageTitle}>
                  {current.title}
                </Text>
                {current.description && (
                  <Text style={styles.pageDescription}>
                    {current.description}
                  </Text>
                )}
                {current.children.map(entry => (
                  <Pressable
                    key={entry.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Browse ${entry.title}`}
                    onPress={() => navigate([...path, entry.id], entry)}
                    style={styles.branchRow}
                  >
                    <View style={styles.branchIcon}>
                      <BookOpen size={19} color={palette.green} />
                    </View>
                    <Text style={styles.branchTitle}>{entry.title}</Text>
                    <ChevronRight size={18} color={palette.muted} />
                  </Pressable>
                ))}
                {!!resourceFormats.length && (
                  <>
                    <SectionTitle title="Learning resources" />
                    <View style={styles.formatList}>
                      {resourceFormats.map(format => (
                        <View key={format} style={styles.formatItem}>
                          <Check size={14} color={palette.green} />
                          <Text style={styles.formatText}>{format}</Text>
                        </View>
                      ))}
                    </View>
                  </>
                )}
                <SectionTitle title="Course previews" />
                {levelFilter}
                {courseGrid(scopedCourses, 'No courses published here yet.')}
              </>
            ) : (
              <>
                <SectionTitle title="Explore categories" />
                <View testID="category-grid" style={styles.categoryGrid}>
                  {catalog.categories.map(entry => (
                    <CategoryCard
                      key={entry.id}
                      entry={entry}
                      width={cardWidth}
                      onPress={() => navigate([entry.id], entry)}
                    />
                  ))}
                </View>
                {user && library.recent.some(id => library.lastOpened[id]) && (
                  <>
                    <SectionTitle title="Continue Learning" />
                    {courseGrid(
                      coursesById(
                        library.recent.filter(id => library.lastOpened[id]),
                      ).slice(0, 3),
                    )}
                  </>
                )}
                <SectionTitle
                  title="Recommended courses"
                  label="PREVIEW CATALOG"
                />
                {levelFilter}
                {courseGrid(
                  catalog.courses.filter(
                    course => course.featured && matchesLevel(course),
                  ),
                )}
                <SectionTitle title="Popular learning" />
                {courseGrid(
                  catalog.courses.filter(
                    course => course.popular && matchesLevel(course),
                  ),
                )}
                {!!library.recent.length && (
                  <>
                    <SectionTitle title="Recently viewed" />
                    {courseGrid(coursesById(library.recent).slice(0, 3))}
                  </>
                )}
              </>
            )}
          </>
        )
      )}
      <View style={styles.footer}>
        <View style={styles.footerLine} />
        <Text style={styles.footerText}>Your next chapter starts here.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.paper },
  content: {
    width: '100%',
    maxWidth: 1520,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 28,
  },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  logo: { flexDirection: 'row', alignItems: 'center', gap: 9, flexShrink: 1 },
  logoIcon: {
    width: 56,
    height: 56,
    flexShrink: 0,
    backgroundColor: palette.white,
  },
  brand: { fontSize: 24, fontWeight: '800', color: palette.ink, flexShrink: 1 },
  brandDot: { color: palette.green },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  welcome: { marginBottom: 20 },
  overline: {
    fontSize: 10,
    lineHeight: 16,
    fontWeight: '700',
    color: palette.muted,
  },
  welcomeTitle: {
    fontFamily: 'serif',
    fontSize: 29,
    lineHeight: 36,
    color: palette.ink,
    fontWeight: '700',
    marginTop: 7,
  },
  welcomeAccent: { color: palette.green },
  searchBox: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 14,
    paddingRight: 4,
    gap: 10,
    borderWidth: 1,
    borderColor: '#DDE6DE',
    backgroundColor: palette.white,
    borderRadius: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    color: palette.ink,
    paddingVertical: 14,
  },
  libraryTabs: {
    flexDirection: 'row',
    gap: 24,
    borderBottomWidth: 1,
    borderBottomColor: palette.line,
    marginTop: 12,
  },
  libraryTab: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  libraryTabSelected: { borderBottomColor: palette.green },
  tabText: { fontSize: 12, color: palette.muted },
  selectedTabText: { color: palette.green, fontWeight: '700' },
  sectionHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 26,
    marginBottom: 14,
  },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: palette.ink },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  categoryCard: {
    flex: 1,
    minHeight: 210,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.white,
    padding: 14,
    shadowColor: '#244134',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.035,
    shadowRadius: 4,
    elevation: 1,
  },
  categoryHovered: { borderColor: '#8EB19C', backgroundColor: '#FCFEFC' },
  categoryIcon: {
    width: 46,
    height: 46,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  categoryTitle: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '700',
    color: palette.ink,
    marginBottom: 5,
  },
  categoryDescription: {
    fontSize: 11,
    lineHeight: 17,
    color: palette.muted,
    marginBottom: 12,
  },
  categoryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 'auto',
  },
  exploreLabel: { fontSize: 11, fontWeight: '700' },
  pressed: { opacity: 0.75 },
  courseGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  courseCard: {
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: palette.white,
  },
  courseImage: {
    width: '100%',
    aspectRatio: 2.2,
    backgroundColor: palette.tint,
  },
  imageFallback: { alignItems: 'center', justifyContent: 'center' },
  courseBody: { padding: 16, paddingBottom: 0 },
  courseCategory: {
    fontSize: 10,
    lineHeight: 15,
    color: palette.green,
    fontWeight: '600',
    marginBottom: 5,
  },
  courseTitle: {
    fontSize: 17,
    lineHeight: 23,
    color: palette.ink,
    fontWeight: '700',
  },
  courseSummary: {
    fontSize: 12,
    lineHeight: 19,
    color: palette.muted,
    marginTop: 6,
  },
  courseLevel: { fontSize: 11, color: palette.muted, marginTop: 12 },
  courseFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 16,
    paddingRight: 8,
    marginTop: 2,
  },
  previewLabel: { fontSize: 9, fontWeight: '700', color: '#82714B' },
  resumeNote: { fontSize: 11, color: palette.green, marginTop: 8 },
  filterRow: { gap: 8, paddingBottom: 16 },
  filter: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: palette.line,
    justifyContent: 'center',
    backgroundColor: palette.white,
  },
  filterSelected: { backgroundColor: palette.tint, borderColor: '#A2BDAD' },
  filterText: { fontSize: 12, color: palette.muted },
  filterTextSelected: { fontWeight: '700', color: palette.green },
  emptyState: {
    paddingVertical: 28,
    gap: 12,
    alignItems: 'center',
    width: '100%',
  },
  emptyText: {
    fontSize: 13,
    lineHeight: 21,
    color: palette.muted,
    textAlign: 'center',
  },
  state: { paddingVertical: 56, alignItems: 'center', gap: 18 },
  muted: { fontSize: 13, color: palette.muted },
  primaryButton: {
    minHeight: 46,
    backgroundColor: palette.green,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  primaryButtonText: { fontSize: 13, fontWeight: '700', color: palette.white },
  warning: { fontSize: 12, lineHeight: 18, color: '#9B4532', marginTop: 12 },
  breadcrumbs: { gap: 6, alignItems: 'center', paddingVertical: 20 },
  breadcrumbItem: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  breadcrumbText: { fontSize: 11, lineHeight: 18, color: palette.muted },
  link: { fontSize: 12, color: palette.green, fontWeight: '700' },
  pageTitle: {
    fontSize: 27,
    lineHeight: 34,
    color: palette.ink,
    fontWeight: '700',
    marginBottom: 10,
  },
  pageDescription: {
    fontSize: 13,
    lineHeight: 21,
    color: palette.muted,
    marginBottom: 16,
  },
  branchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 62,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: palette.line,
  },
  branchIcon: {
    width: 36,
    height: 36,
    borderRadius: 6,
    backgroundColor: palette.tint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  branchTitle: {
    flex: 1,
    fontSize: 14,
    lineHeight: 21,
    color: palette.ink,
    fontWeight: '600',
  },
  activeBranch: { backgroundColor: palette.tint },
  unitNumber: {
    fontSize: 12,
    fontWeight: '700',
    color: palette.green,
    width: 28,
  },
  formatList: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  formatItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  formatText: { fontSize: 12, color: palette.muted },
  back: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    flexWrap: 'wrap',
    marginTop: 8,
    marginBottom: 12,
  },
  previewStatus: { fontSize: 9, fontWeight: '700', color: '#82714B' },
  detailMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  levelLabel: { fontSize: 12, color: palette.muted },
  saveCourse: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
  },
  resourcePreview: {
    alignItems: 'center',
    gap: 14,
    paddingVertical: 36,
    borderTopWidth: 1,
    borderTopColor: palette.line,
  },
  footer: { alignItems: 'center', paddingTop: 34, gap: 14 },
  footerLine: { height: 1, width: 40, backgroundColor: '#B9C9BD' },
  footerText: { fontSize: 11, color: '#77877D' },
});
