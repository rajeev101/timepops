/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import React, { useState } from 'react';
import ExploreHome from './src/ExploreHome';
import ChatScreen from './src/chat/ChatScreen';
import type {ChatSession} from './src/chat/api';
import {LanguageProvider, useLanguage} from './src/i18n/LanguageProvider';
import LanguageShell from './src/i18n/LanguageShell';
import ContentLanguageGate from './src/i18n/ContentLanguageGate';
import {Text, View} from './src/i18n/components';
import {
  BookOpen, Home, MessageCircle, User, ChartNoAxesColumn,
} from 'lucide-react-native';
import {
  ScrollView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

type ScreenId =
  | 'home'
  | 'curriculum'
  | 'chat'
  | 'progress'
  | 'profile'
  | 'flashcards'
  | 'mockTest'
  | 'smartReview';

interface Flashcard {
  id: string;
  subject: string;
  deck: string;
  question: string;
  answer: string;
}

const NAV_ITEMS = [
  {id: 'home', label: 'Explore', icon: Home},
  {id: 'curriculum', label: 'Study', icon: BookOpen},
  {id: 'chat', label: 'Chat', icon: MessageCircle},
  {id: 'progress', label: 'Stats', icon: ChartNoAxesColumn},
  {id: 'profile', label: 'Profile', icon: User},
] as const;

const FLASHCARDS: Flashcard[] = [
  {
    id: '1',
    subject: 'SAT MATH',
    deck: 'Linear functions and slope intercept',
    question: 'What is the slope-intercept form of a linear equation?',
    answer: 'y = mx + b',
  },
  {
    id: '2',
    subject: 'SAT MATH',
    deck: 'Linear functions and slope intercept',
    question: 'How do you find the slope (m) between two points?',
    answer: 'm = (y₂ - y₁) / (x₂ - x₁)',
  },
  {
    id: '3',
    subject: 'SAT MATH',
    deck: 'Quadratic equations',
    question: 'What is the quadratic formula?',
    answer: 'x = (-b ± √(b² - 4ac)) / 2a',
  },
];

const MOCK_QUESTIONS = [
  {
    id: 'q1',
    subject: 'MATH',
    question: 'What is the value of 7 + 6 × 3?',
    options: [
      { label: 'A', value: '25' },
      { label: 'B', value: '27' },
      { label: 'C', value: '19' },
      { label: 'D', value: '21' },
    ],
    correct: 'A',
  },
  {
    id: 'q2',
    subject: 'MATH',
    question: 'If 3x + 7 = 22, what is the value of x?',
    options: [
      { label: 'A', value: '3' },
      { label: 'B', value: '5' },
      { label: 'C', value: '7' },
      { label: 'D', value: '9' },
    ],
    correct: 'B',
  },
  {
    id: 'q3',
    subject: 'ALGEBRA',
    question: 'What is the y-intercept of the line y = 4x - 9?',
    options: [
      { label: 'A', value: '4' },
      { label: 'B', value: '9' },
      { label: 'C', value: '-9' },
      { label: 'D', value: '-4' },
    ],
    correct: 'C',
  },
];

const SMART_REVIEW_QUESTIONS = [
  {
    id: 'sr1',
    subject: 'PHYSICS',
    question:
      'A body is thrown vertically upward with velocity u. The maximum height reached is:',
    options: [
      { label: 'A', value: 'u² / g' },
      { label: 'B', value: 'u² / 2g' },
      { label: 'C', value: '2u² / g' },
      { label: 'D', value: 'u / 2g' },
    ],
    correct: 'B',
    explanation:
      'Using the kinematic equation v² = u² - 2gh, at maximum height final velocity v = 0. Solving 0 = u² - 2gh gives h = u² / 2g.',
  },
  {
    id: 'sr2',
    subject: 'SAT MATH',
    question:
      'Which of the following lines is parallel to y = 3x + 5?',
    options: [
      { label: 'A', value: 'y = -3x + 5' },
      { label: 'B', value: 'y = (1/3)x - 2' },
      { label: 'C', value: 'y = 3x - 8' },
      { label: 'D', value: 'y = 5x + 3' },
    ],
    correct: 'C',
    explanation:
      'Parallel lines have the exact same slope (m = 3) and different y-intercepts.',
  },
  {
    id: 'sr3',
    subject: 'CHEMISTRY',
    question: 'What is the pH of a neutral pure water solution at 25°C?',
    options: [
      { label: 'A', value: '0' },
      { label: 'B', value: '5.5' },
      { label: 'C', value: '7.0' },
      { label: 'D', value: '14.0' },
    ],
    correct: 'C',
    explanation:
      'At 25°C, [H⁺] = [OH⁻] = 1.0 × 10⁻⁷ M, giving a neutral pH of 7.0.',
  },
];

function App({session}: {session?:ChatSession}) {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      <LanguageProvider><LanguageShell><StudentAIApp session={session} /></LanguageShell></LanguageProvider>
    </SafeAreaProvider>
  );
}

function StudentAIApp({session}: {session?:ChatSession}) {
  const {t} = useLanguage();
  const insets = useSafeAreaInsets();
  const [screen, setScreen] = useState<ScreenId>('home');

  // Flashcards state
  const [cardIndex, setCardIndex] = useState(0);
  const [showCardAnswer, setShowCardAnswer] = useState(true);

  // Mock Test state
  const [mockIndex, setMockIndex] = useState(0);
  const [mockAnswers, setMockAnswers] = useState<Record<string, string>>({});

  // Smart Review state
  const [reviewIndex, setReviewIndex] = useState(0);
  const [reviewSelected, setReviewSelected] = useState<string>('B');
  const [showExplanation, setShowExplanation] = useState(false);

  // Curriculum state
  const [curricula, setCurricula] = useState([
    {
      id: 'c1',
      title: 'SAT Spring 2026',
      subtitle: 'Math and Reading',
      topics: '4 topics',
      active: true,
    },
    {
      id: 'c2',
      title: 'AP Physics 1',
      subtitle: 'Kinematics, Dynamics & Energy',
      topics: '7 topics',
      active: false,
    },
    {
      id: 'c3',
      title: 'GCSE English Literature',
      subtitle: 'Essay Rubrics & Text Analysis',
      topics: '5 topics',
      active: false,
    },
  ]);

  const lightScreen=screen==='home'||screen==='chat';
  const activeTab: 'home' | 'curriculum' | 'chat' | 'progress' | 'profile' =
    screen === 'flashcards' || screen === 'curriculum'
      ? 'curriculum'
      : screen === 'chat'
      ? 'chat'
      : screen === 'progress' || screen === 'mockTest'
      ? 'progress'
      : screen === 'profile'
      ? 'profile'
      : 'home';

  const renderHome = () => (
    <ExploreHome onAccountPress={() => setScreen('profile')} />
  );

  const renderChat = () => (
    <View style={[styles.flexOne,screen!=='chat'&&styles.hidden]} accessibilityElementsHidden={screen!=='chat'} importantForAccessibility={screen==='chat'?'auto':'no-hide-descendants'}>
      <ChatScreen key={session?.userId??'guest'} session={session} active={screen==='chat'} />
    </View>
  );

  const renderCurriculum = () => (
    <ScrollView
      style={styles.scrollArea}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}>
      <View style={styles.topNavRow}>
        <TouchableOpacity onPress={() => setScreen('home')}>
          <Text style={styles.backArrowText}>←</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.newPurplePillBtn}
          onPress={() =>
            setCurricula(prev => [
              ...prev,
              {
                id: String(Date.now()),
                title: `IB Mathematics HL`,
                subtitle: 'Calculus & Statistics',
                topics: '6 topics',
                active: false,
              },
            ])
          }>
          <Text style={styles.newPurplePillText}>+  New</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.smallBrandLabel}>bharatshiksak</Text>
      <Text style={styles.screenHeaderTitle}>My Curriculum</Text>
      <Text style={styles.greetingSubtitle}>
        Custom syllabi for your study plan.
      </Text>

      {curricula.map(item => (
        <TouchableOpacity
          key={item.id}
          style={styles.curriculumCard}
          onPress={() =>
            setCurricula(prev =>
              prev.map(c => ({ ...c, active: c.id === item.id })),
            )
          }>
          <View style={styles.curriculumRowTop}>
            <Text style={styles.curriculumTitle}>{item.title}</Text>
            <View
              style={[
                styles.statusBadge,
                !item.active && styles.statusBadgeInactive,
              ]}>
              <Text style={styles.statusBadgeText}>
                {item.active ? 'Active' : 'Select'}
              </Text>
            </View>
          </View>
          <View style={styles.curriculumMetaRow}>
            <Text style={styles.curriculumSubtitle}>{item.subtitle}</Text>
            <View style={styles.topicCountPill}>
              <Text style={styles.topicCountText}>{item.topics}</Text>
            </View>
          </View>
        </TouchableOpacity>
      ))}

      {/* Quick switch to Flashcards or Smart Review */}
      <View style={styles.curriculumActionsSection}>
        <Text style={styles.fieldCaption}>STUDY TOOLS FOR ACTIVE SYLLABUS</Text>
        <TouchableOpacity
          style={styles.primaryPurpleBtn}
          onPress={() => setScreen('flashcards')}>
          <Text style={styles.primaryPurpleBtnText}>
            Open Flashcard Deck (10 cards)  →
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.secondaryDarkBtn}
          onPress={() => setScreen('mockTest')}>
          <Text style={styles.secondaryDarkBtnText}>
            Start Timed Mock Exam (20 Qs)
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  const renderFlashcards = () => {
    const currentCard = FLASHCARDS[cardIndex % FLASHCARDS.length];
    const nextCard = () => {
      setShowCardAnswer(false);
      setCardIndex(prev => (prev + 1) % FLASHCARDS.length);
    };

    return (
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <View style={styles.flashTopHeader}>
          <TouchableOpacity onPress={() => setScreen('curriculum')}>
            <Text style={styles.backArrowText}>←</Text>
          </TouchableOpacity>
          <View style={styles.flashHeaderCenter}>
            <Text style={styles.flashDeckTitle} numberOfLines={1}>
              {currentCard.deck}
            </Text>
            <Text style={styles.flashDeckCount}>
              Card {cardIndex + 1} of 10
            </Text>
          </View>
          <View style={styles.smallRing} />
        </View>

        <Text style={styles.flashSubjectLabel}>{currentCard.subject}</Text>

        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.flashcardBox}
          onPress={() => setShowCardAnswer(!showCardAnswer)}>
          <Text style={styles.flashcardTypeLabel}>
            {showCardAnswer ? 'ANSWER' : 'QUESTION (TAP TO FLIP)'}
          </Text>
          <Text style={styles.flashcardMainText}>
            {showCardAnswer ? currentCard.answer : currentCard.question}
          </Text>
        </TouchableOpacity>

        <View style={styles.ratingGrid}>
          <TouchableOpacity
            style={[styles.ratingBtn, styles.ratingBtnAgain]}
            onPress={nextCard}>
            <Text style={styles.ratingTitleAgain}>Again</Text>
            <Text style={styles.ratingSubAgain}>{'<1d'}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.ratingBtn} onPress={nextCard}>
            <Text style={styles.ratingTitleNeutral}>Hard</Text>
            <Text style={styles.ratingSubNeutral}>soon</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.ratingBtn, styles.ratingBtnGood]}
            onPress={nextCard}>
            <Text style={styles.ratingTitleGood}>Good</Text>
            <Text style={styles.ratingSubGood}>later</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.ratingBtn} onPress={nextCard}>
            <Text style={styles.ratingTitleNeutral}>Easy</Text>
            <Text style={styles.ratingSubNeutral}>4d+</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  };

  const renderMockTest = () => {
    const q = MOCK_QUESTIONS[mockIndex % MOCK_QUESTIONS.length];
    const selected = mockAnswers[q.id];
    const answeredCount = Object.keys(mockAnswers).length;

    return (
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <View style={styles.flashTopHeader}>
          <TouchableOpacity onPress={() => setScreen('home')}>
            <Text style={styles.quitText}>←  Quit</Text>
          </TouchableOpacity>
          <View style={styles.flashHeaderCenter}>
            <Text style={styles.timerMainText}>0:01</Text>
            <Text style={styles.flashDeckCount}>
              {answeredCount}/20 answered
            </Text>
          </View>
          <Text style={styles.flashDeckCount}>{mockIndex + 1}/20</Text>
        </View>

        <View style={styles.mockCard}>
          <Text style={styles.mockSubjectLabel}>{q.subject}</Text>
          <Text style={styles.mockQuestionText}>{q.question}</Text>

          {q.options.map(opt => {
            const isPicked = selected === opt.label;
            return (
              <TouchableOpacity
                key={opt.label}
                style={[
                  styles.mockOptionRow,
                  isPicked && styles.mockOptionRowSelected,
                ]}
                onPress={() =>
                  setMockAnswers(prev => ({ ...prev, [q.id]: opt.label }))
                }>
                <Text style={styles.mockOptionLetter}>{opt.label}.</Text>
                <Text style={styles.mockOptionValue}>{opt.value}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.mockNavRow}>
          <TouchableOpacity
            style={styles.mockPrevBtn}
            onPress={() => setMockIndex(prev => Math.max(0, prev - 1))}>
            <Text style={styles.mockPrevBtnText}>Previous</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.mockNextBtn}
            onPress={() =>
              setMockIndex(prev => (prev + 1) % MOCK_QUESTIONS.length)
            }>
            <Text style={styles.mockNextBtnText}>Next  →</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  };

  const renderSmartReview = () => {
    const q =
      SMART_REVIEW_QUESTIONS[reviewIndex % SMART_REVIEW_QUESTIONS.length];

    return (
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <View style={styles.flashTopHeader}>
          <TouchableOpacity onPress={() => setScreen('home')}>
            <Text style={styles.quitText}>←  Exit session</Text>
          </TouchableOpacity>
          <View style={styles.segmentedProgressRow}>
            {[0, 1, 2].map(idx => (
              <View
                key={idx}
                style={[
                  styles.segmentBarItem,
                  idx <= reviewIndex && styles.segmentBarItemActive,
                ]}
              />
            ))}
          </View>
          <Text style={styles.flashDeckCount}>{reviewIndex + 1}/3</Text>
        </View>

        <View style={styles.reviewSubheaderRow}>
          <Text style={styles.mockSubjectLabel}>{q.subject}</Text>
          <View style={styles.smallRing} />
        </View>

        <View style={styles.smartGreenCard}>
          <Text style={styles.mockQuestionText}>{q.question}</Text>

          {q.options.map(opt => {
            const isSelected = reviewSelected === opt.label;
            const isCorrect = opt.label === q.correct;
            return (
              <TouchableOpacity
                key={opt.label}
                style={[
                  styles.reviewOptionRow,
                  isSelected && isCorrect && styles.reviewOptionCorrect,
                  isSelected && !isCorrect && styles.reviewOptionWrong,
                ]}
                onPress={() => setReviewSelected(opt.label)}>
                <View
                  style={[
                    styles.reviewBadgeCircle,
                    isSelected &&
                      isCorrect &&
                      styles.reviewBadgeCircleCorrect,
                  ]}>
                  <Text
                    style={[
                      styles.reviewBadgeLetter,
                      isSelected &&
                        isCorrect &&
                        styles.reviewBadgeLetterCorrect,
                    ]}>
                    {opt.label}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.reviewOptionValue,
                    isSelected && isCorrect && styles.reviewOptionValueCorrect,
                  ]}>
                  {opt.value}
                </Text>
                {isSelected && isCorrect && (
                  <Text style={styles.checkIconText}>✓</Text>
                )}
              </TouchableOpacity>
            );
          })}

          <TouchableOpacity
            style={styles.explanationToggle}
            onPress={() => setShowExplanation(!showExplanation)}>
            <Text style={styles.explanationToggleText}>
              {showExplanation ? '⌃  Hide explanation' : '⌄  Show explanation'}
            </Text>
          </TouchableOpacity>

          {showExplanation && (
            <Text style={styles.explanationBodyText}>{q.explanation}</Text>
          )}
        </View>

        <TouchableOpacity
          style={styles.primaryPurpleBtn}
          onPress={() => {
            const nextIdx = (reviewIndex + 1) % SMART_REVIEW_QUESTIONS.length;
            setReviewIndex(nextIdx);
            setReviewSelected(SMART_REVIEW_QUESTIONS[nextIdx].correct);
            setShowExplanation(false);
          }}>
          <Text style={styles.primaryPurpleBtnText}>Next question  →</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  };

  const renderProgress = () => (
    <ScrollView
      style={styles.scrollArea}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}>
      <Text style={styles.smallBrandLabel}>bharatshiksak</Text>
      <Text style={styles.screenHeaderTitle}>Progress & Analytics</Text>
      <Text style={styles.greetingSubtitle}>
        Streaks, mock test scores, and spaced-repetition mastery.
      </Text>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>7 🔥</Text>
          <Text style={styles.statLabel}>Day Streak</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>94%</Text>
          <Text style={styles.statLabel}>Retention</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>1,480</Text>
          <Text style={styles.statLabel}>Est. SAT</Text>
        </View>
      </View>

      <View style={styles.smartReviewCard}>
        <Text style={styles.smartReviewLabel}>EXAM READINESS</Text>
        <Text style={styles.smartReviewTitle}>SAT Math & Physics</Text>
        <Text style={styles.greetingSubtitle}>
          You have completed 18 flashcards and 3 smart review sessions this
          week.
        </Text>
        <TouchableOpacity
          style={styles.primaryPurpleBtn}
          onPress={() => setScreen('mockTest')}>
          <Text style={styles.primaryPurpleBtnText}>
            Launch Timed Mock Test  →
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.secondaryDarkBtn}
          onPress={() => setScreen('smartReview')}>
          <Text style={styles.secondaryDarkBtnText}>
            Practice Weak Spots (Smart Review)
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  const renderProfile = () => (
    <ScrollView
      style={styles.scrollArea}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}>
      <Text style={styles.smallBrandLabel}>bharatshiksak</Text>
      <Text style={styles.screenHeaderTitle}>Olivia's Profile</Text>
      <Text style={styles.greetingSubtitle}>
        Curriculum-aligned settings & bharatshiksak Pro plan.
      </Text>

      <View style={styles.curriculumCard}>
        <Text style={styles.curriculumTitle}>Olivia Martinez</Text>
        <Text style={styles.curriculumSubtitle}>
          Grade 12 • US High School (SAT / AP Board)
        </Text>
      </View>

      <View style={styles.smartReviewCard}>
        <Text style={styles.smartReviewLabel}>SUBSCRIPTION</Text>
        <Text style={styles.smartReviewTitle}>bharatshiksak Pro</Text>
        <Text style={styles.greetingSubtitle}>
          Unlimited curriculum-aligned explanations, PDF flashcard decks, and
          BharatShikshak AI.
        </Text>
        <TouchableOpacity
          style={styles.primaryPurpleBtn}
          onPress={() => setScreen('curriculum')}>
          <Text style={styles.primaryPurpleBtnText}>
            Manage Active Syllabi  →
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  return (
    <View
      style={[
        styles.rootContainer,
        lightScreen && styles.dashboardRoot,
        { paddingBottom: insets.bottom },
      ]}>
      <StatusBar barStyle={lightScreen ? 'dark-content' : 'light-content'} />
      <View style={styles.flexOne}>
        {screen === 'home' && renderHome()}
        {renderChat()}
        {(['curriculum','flashcards','mockTest','smartReview'] as ScreenId[]).includes(screen) && <ContentLanguageGate contentId={`legacy-${screen}`} onCancel={() => setScreen('home')}>
          {screen === 'curriculum' && renderCurriculum()}
          {screen === 'flashcards' && renderFlashcards()}
          {screen === 'mockTest' && renderMockTest()}
          {screen === 'smartReview' && renderSmartReview()}
        </ContentLanguageGate>}
        {screen === 'progress' && renderProgress()}
        {screen === 'profile' && renderProfile()}
      </View>

      <View style={[styles.bottomTabBar, lightScreen && styles.dashboardTabBar]}>
        {NAV_ITEMS.map(item => {
          const selected = activeTab === item.id;
          const color = selected ? (lightScreen ? '#277653' : '#FFFFFF') : '#7B847F';
          return (
            <TouchableOpacity key={item.id} accessibilityRole="tab" accessibilityLabel={item.label} accessibilityState={{selected}} style={styles.tabItem} onPress={() => setScreen(item.id)}>
              <item.icon size={21} color={color} strokeWidth={selected ? 2.4 : 1.7} />
              <Text style={[styles.tabLabel, {color}]}>{t(`ui.${({home: 'explore', curriculum: 'study', chat: 'chat', progress: 'stats', profile: 'profile'} as const)[item.id]}`)}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hidden: {display:'none'},
  dashboardRoot: {backgroundColor: '#F8FAF8'},
  dashboardContent: {paddingHorizontal: 22, paddingBottom: 28, maxWidth: 720, width: '100%', alignSelf: 'center'},
  dashboardHeader: {flexDirection: 'row', alignItems: 'center', marginBottom: 30, paddingTop: 8},
  dashboardBrand: {fontSize: 25, fontWeight: '800', color: '#202C25'},
  brandDot: {color: '#277653'},
  curriculumPicker: {flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44},
  curriculumLink: {fontSize: 12, color: '#59665E', flexShrink: 1},
  dashboardAvatar: {width: 46, height: 46, borderRadius: 23, backgroundColor: '#F6E6BC', alignItems: 'center', justifyContent: 'center'},
  avatarInitials: {fontSize: 14, fontWeight: '700', color: '#695321'},
  dashboardEyebrow: {fontSize: 10, fontWeight: '700', color: '#64756A'},
  dashboardTitle: {fontSize: 34, lineHeight: 40, fontWeight: '700', color: '#202C25', marginTop: 10, fontFamily: 'serif'},
  titleAccent: {color: '#277653'},
  dashboardSubtitle: {fontSize: 13, lineHeight: 21, color: '#657168', marginTop: 10, marginBottom: 22},
  dashboardSearch: {flexDirection: 'row', alignItems: 'center', backgroundColor: '#EFF3EF', borderRadius: 8, paddingHorizontal: 14, minHeight: 50, gap: 10},
  dashboardSearchInput: {flex: 1, color: '#202C25', fontSize: 14, paddingVertical: 12},
  clearSearch: {minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center'},
  dashboardSectionHeader: {flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between', marginTop: 26, marginBottom: 14},
  dashboardSectionTitle: {fontSize: 18, fontWeight: '700', color: '#202C25'},
  sectionNumber: {fontSize: 10, fontWeight: '600', color: '#737E76'},
  sectionLink: {fontSize: 12, fontWeight: '700', color: '#277653', paddingVertical: 8},
  continueLesson: {flexDirection: 'row', backgroundColor: '#E4EFE9', borderRadius: 8, overflow: 'hidden'},
  lessonText: {flex: 1, padding: 18},
  lessonEyebrow: {fontSize: 9, lineHeight: 15, fontWeight: '700', color: '#426551'},
  lessonTitle: {fontSize: 20, lineHeight: 26, fontWeight: '700', color: '#223F2E', marginTop: 8},
  lessonMeta: {fontSize: 11, color: '#526C5C', marginTop: 8},
  lessonActionRow: {flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 18, flexWrap: 'wrap'},
  lessonAction: {fontSize: 13, fontWeight: '700', color: '#205C3E'},
  lessonImage: {width: '30%', height: '100%', minHeight: 205, resizeMode: 'cover'},
  subjectFilters: {gap: 8, paddingBottom: 10},
  subjectFilter: {minHeight: 44, justifyContent: 'center', paddingHorizontal: 18, borderBottomWidth: 2, borderBottomColor: 'transparent'},
  subjectFilterSelected: {borderBottomColor: '#277653'},
  subjectFilterText: {fontSize: 13, color: '#6A756D'},
  subjectFilterTextSelected: {color: '#236144', fontWeight: '700'},
  subjectRow: {flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#E7ECE7'},
  subjectArtwork: {width: 52, height: 56, borderRadius: 8, alignItems: 'center', justifyContent: 'center'},
  subjectSymbol: {fontSize: 26, fontFamily: 'serif', fontWeight: '700'},
  subjectTitle: {fontSize: 15, fontWeight: '700', color: '#253329'},
  subjectDetail: {fontSize: 12, lineHeight: 18, color: '#6B766E', marginTop: 4},
  emptySubjects: {fontSize: 13, lineHeight: 20, color: '#657168', paddingVertical: 24},
  subjectStatus: {paddingVertical: 24, alignItems: 'center', gap: 8},
  retrySubjects: {flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, paddingHorizontal: 16},
  practiceGrid: {flexDirection: 'row', flexWrap: 'wrap', gap: 12},
  practiceTile: {flexGrow: 1, flexBasis: 140, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8E2', padding: 16, backgroundColor: '#FFFFFF'},
  practiceSymbol: {marginBottom: 12},
  practiceTitle: {fontSize: 15, fontWeight: '700', color: '#253329'},
  practiceDetail: {fontSize: 11, lineHeight: 17, color: '#6B766E', marginTop: 6},
  tutorRow: {flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12, borderTopWidth: 1, borderTopColor: '#E2E8E2', marginTop: 24, paddingTop: 20},
  dashboardTabBar: {backgroundColor: '#FFFFFF', borderTopColor: '#E2E8E2'},
  rootContainer: {
    flex: 1,
    paddingTop: 8,
    backgroundColor: '#0A0A0F',
  },
  flexOne: {
    flex: 1,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingBottom: 28,
  },
  greetingTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
    marginTop: 6,
  },
  greetingSubtitle: {
    color: '#9494A8',
    fontSize: 14,
    marginTop: 4,
    marginBottom: 16,
  },
  promptBox: {
    backgroundColor: '#13131C',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#252536',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    minHeight: 92,
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 14,
  },
  promptInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15,
    paddingTop: 0,
    paddingBottom: 0,
    marginRight: 10,
  },
  promptSendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#6D28D9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendIconText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 18,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#13131C',
    borderWidth: 1,
    borderColor: '#252536',
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 20,
  },
  chipEmoji: {
    fontSize: 13,
    marginRight: 6,
  },
  chipText: {
    color: '#E6E6F0',
    fontSize: 13,
    fontWeight: '600',
  },
  smartReviewCard: {
    backgroundColor: '#151520',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#262638',
    padding: 18,
    marginBottom: 14,
  },
  smartReviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  smartReviewLabel: {
    color: '#8A8A9E',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 4,
  },
  smartReviewTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  progressRing: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 4,
    borderColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressRingText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  generationsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  generationsLabel: {
    color: '#8A8A9E',
    fontSize: 12,
  },
  generationsValue: {
    color: '#C4C4D4',
    fontSize: 12,
    fontWeight: '600',
  },
  generationsTrack: {
    height: 4,
    backgroundColor: '#252538',
    borderRadius: 2,
    marginBottom: 16,
  },
  generationsFill: {
    width: '25%',
    height: 4,
    backgroundColor: '#8B5CF6',
    borderRadius: 2,
  },
  primaryPurpleBtn: {
    backgroundColor: '#7C3AED',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  primaryPurpleBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryDarkBtn: {
    backgroundColor: '#1B1B28',
    borderWidth: 1,
    borderColor: '#2E2E42',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
  },
  secondaryDarkBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  infoRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#14141F',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#252536',
    padding: 14,
    marginBottom: 12,
  },
  infoIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#1F1B3A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  infoIconText: {
    fontSize: 16,
  },
  infoTextCol: {
    flex: 1,
    marginRight: 8,
  },
  infoCardTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  infoCardSubtitle: {
    color: '#8E8EA2',
    fontSize: 12,
    marginTop: 2,
  },
  smallOpenBtn: {
    backgroundColor: '#1D1D2C',
    borderWidth: 1,
    borderColor: '#323248',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  smallOpenBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  smallBrandLabel: {
    color: '#8A8A9E',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.1,
  },
  screenHeaderTitle: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '800',
    marginTop: 2,
  },
  chatTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 18,
    paddingBottom: 10,
  },
  chatHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTagBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#161622',
  },
  headerTagText: {
    color: '#C4C4D4',
    fontSize: 12,
  },
  headerTagTextBold: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  miaBadgeText: {
    color: '#8A8A9E',
    fontSize: 12,
    marginLeft: 2,
  },
  fieldCaption: {
    color: '#8A8A9E',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginTop: 8,
    marginBottom: 8,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: '#151520',
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: '#252538',
    marginBottom: 10,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  segmentBtnActive: {
    backgroundColor: '#7C3AED',
  },
  segmentBtnText: {
    color: '#9E9EB2',
    fontSize: 14,
    fontWeight: '600',
  },
  segmentBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  subjectInputBox: {
    backgroundColor: '#151520',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#252538',
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
  },
  subjectInputText: {
    color: '#FFFFFF',
    fontSize: 15,
    padding: 0,
  },
  divider: {
    height: 1,
    backgroundColor: '#1E1E2C',
    marginVertical: 10,
  },
  userBubbleWrap: {
    alignItems: 'flex-end',
    marginBottom: 12,
  },
  userBubble: {
    backgroundColor: '#291D47',
    borderWidth: 1,
    borderColor: '#48327A',
    borderRadius: 16,
    padding: 14,
    maxWidth: '86%',
  },
  miaBubbleWrap: {
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  miaBubble: {
    backgroundColor: '#161622',
    borderWidth: 1,
    borderColor: '#262638',
    borderRadius: 16,
    padding: 15,
    maxWidth: '92%',
  },
  bubbleText: {
    color: '#F2F2F8',
    fontSize: 14,
    lineHeight: 21,
  },
  chatComposerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#1D1D2B',
    backgroundColor: '#0E0E15',
    gap: 8,
  },
  composerIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#191926',
    alignItems: 'center',
    justifyContent: 'center',
  },
  composerIconText: {
    fontSize: 15,
  },
  composerInput: {
    flex: 1,
    backgroundColor: '#161622',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#262638',
    paddingHorizontal: 15,
    paddingVertical: 9,
    color: '#FFFFFF',
    fontSize: 14,
  },
  composerSendBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#6D28D9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topNavRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  backArrowText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
  },
  newPurplePillBtn: {
    backgroundColor: '#7C3AED',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  newPurplePillText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  curriculumCard: {
    backgroundColor: '#161622',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#28283C',
    padding: 16,
    marginBottom: 12,
  },
  curriculumRowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  curriculumTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  statusBadge: {
    backgroundColor: '#7C3AED',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeInactive: {
    backgroundColor: '#252538',
  },
  statusBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  curriculumMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  curriculumSubtitle: {
    color: '#A0A0B4',
    fontSize: 13,
  },
  topicCountPill: {
    backgroundColor: '#222232',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  topicCountText: {
    color: '#D4D4E4',
    fontSize: 11,
    fontWeight: '600',
  },
  curriculumActionsSection: {
    marginTop: 14,
  },
  flashTopHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  flashHeaderCenter: {
    alignItems: 'center',
    flex: 1,
    paddingHorizontal: 10,
  },
  flashDeckTitle: {
    color: '#D4D4E4',
    fontSize: 13,
    fontWeight: '600',
  },
  flashDeckCount: {
    color: '#7E7E92',
    fontSize: 11,
    marginTop: 2,
  },
  smallRing: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2.5,
    borderColor: '#7C3AED',
  },
  flashSubjectLabel: {
    color: '#9A9AB0',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 10,
  },
  flashcardBox: {
    backgroundColor: '#131122',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#2D2654',
    height: 270,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    marginBottom: 18,
  },
  flashcardTypeLabel: {
    color: '#8B5CF6',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 12,
  },
  flashcardMainText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  ratingGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },
  ratingBtn: {
    width: '48%',
    backgroundColor: '#14141F',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2A2A3C',
    paddingVertical: 14,
    alignItems: 'center',
  },
  ratingBtnAgain: {
    backgroundColor: '#24141B',
    borderColor: '#5E2434',
  },
  ratingBtnGood: {
    backgroundColor: '#191430',
    borderColor: '#4C3285',
  },
  ratingTitleAgain: {
    color: '#F87171',
    fontSize: 15,
    fontWeight: '700',
  },
  ratingSubAgain: {
    color: '#EF4444',
    fontSize: 11,
    marginTop: 2,
  },
  ratingTitleGood: {
    color: '#A78BFA',
    fontSize: 15,
    fontWeight: '700',
  },
  ratingSubGood: {
    color: '#8B5CF6',
    fontSize: 11,
    marginTop: 2,
  },
  ratingTitleNeutral: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  ratingSubNeutral: {
    color: '#8E8EA2',
    fontSize: 11,
    marginTop: 2,
  },
  quitText: {
    color: '#E2E2F0',
    fontSize: 14,
    fontWeight: '600',
  },
  timerMainText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  mockCard: {
    backgroundColor: '#161621',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#28283A',
    padding: 18,
    marginBottom: 16,
  },
  mockSubjectLabel: {
    color: '#9A9AB0',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  mockQuestionText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 23,
    marginBottom: 16,
  },
  mockOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1B1B28',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2D2D42',
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 10,
  },
  mockOptionRowSelected: {
    borderColor: '#8B5CF6',
    backgroundColor: '#231B3F',
  },
  mockOptionLetter: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    marginRight: 10,
  },
  mockOptionValue: {
    color: '#D4D4E4',
    fontSize: 15,
  },
  mockNavRow: {
    flexDirection: 'row',
    gap: 12,
  },
  mockPrevBtn: {
    backgroundColor: '#171722',
    borderWidth: 1,
    borderColor: '#2A2A3C',
    paddingHorizontal: 22,
    paddingVertical: 13,
    borderRadius: 12,
  },
  mockPrevBtnText: {
    color: '#A0A0B4',
    fontSize: 14,
    fontWeight: '600',
  },
  mockNextBtn: {
    backgroundColor: '#6D28D9',
    paddingHorizontal: 26,
    paddingVertical: 13,
    borderRadius: 12,
  },
  mockNextBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  segmentedProgressRow: {
    flexDirection: 'row',
    gap: 6,
    flex: 1,
    marginHorizontal: 16,
  },
  segmentBarItem: {
    flex: 1,
    height: 3,
    backgroundColor: '#262638',
    borderRadius: 2,
  },
  segmentBarItemActive: {
    backgroundColor: '#8B5CF6',
  },
  reviewSubheaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  smartGreenCard: {
    backgroundColor: '#121512',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#65A30D',
    padding: 18,
    marginBottom: 18,
  },
  reviewOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1C1E',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2B2E33',
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
  },
  reviewOptionCorrect: {
    backgroundColor: '#223015',
    borderColor: '#84CC16',
  },
  reviewOptionWrong: {
    backgroundColor: '#2D161B',
    borderColor: '#EF4444',
  },
  reviewBadgeCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#25282E',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  reviewBadgeCircleCorrect: {
    backgroundColor: '#A3E635',
  },
  reviewBadgeLetter: {
    color: '#A0A0B4',
    fontSize: 13,
    fontWeight: '700',
  },
  reviewBadgeLetterCorrect: {
    color: '#0A0A0F',
  },
  reviewOptionValue: {
    flex: 1,
    color: '#8E8EA2',
    fontSize: 15,
    fontWeight: '600',
  },
  reviewOptionValueCorrect: {
    color: '#D9F99D',
    fontWeight: '700',
  },
  checkIconText: {
    color: '#A3E635',
    fontSize: 16,
    fontWeight: '800',
  },
  explanationToggle: {
    marginTop: 6,
    paddingVertical: 6,
  },
  explanationToggleText: {
    color: '#D4D4E4',
    fontSize: 13,
    fontWeight: '600',
  },
  explanationBodyText: {
    color: '#B4B4C8',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#151520',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#252538',
    paddingVertical: 16,
    alignItems: 'center',
  },
  statValue: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
  },
  statLabel: {
    color: '#8E8EA2',
    fontSize: 12,
    marginTop: 4,
  },
  bottomTabBar: {
    flexDirection: 'row',
    backgroundColor: '#111119',
    borderTopWidth: 1,
    borderTopColor: '#222232',
    paddingVertical: 8,
    justifyContent: 'space-around',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    minHeight: 48,
  },
  tabIcon: {
    fontSize: 18,
    color: '#6E6E82',
  },
  tabIconActive: {
    color: '#FFFFFF',
  },
  tabLabel: {
    fontSize: 10,
    color: '#6E6E82',
    marginTop: 2,
    fontWeight: '600',
  },
  tabLabelActive: {
    color: '#FFFFFF',
  },
});

export default App;

