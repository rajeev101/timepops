const schoolFormats = [
  'Video lectures',
  'Study notes',
  'NCERT solutions',
  'Practice questions',
  'Chapter-wise tests',
  'Previous-year papers',
];
const examFormats = [
  'Complete syllabus',
  'Study materials',
  'Video lectures',
  'Previous-year questions',
  'Mock tests',
  'Current affairs',
  'Performance analysis',
];
const collegeFormats = [
  'Unit-wise notes',
  'Study materials',
  'Video lectures',
  'Assignments',
  'Previous-year university papers',
  'MCQ practice',
  'Examination preparation',
];
const computerFormats = [
  'Lessons',
  'Notes',
  'Practical examples',
  'Exercises',
  'Quizzes',
  'Projects',
];
const englishFormats = [
  'Daily lessons',
  'Speaking practice',
  'Reading and writing',
  'Listening practice',
];

const courses = [
  {
    id: 'spoken-english',
    title: 'Everyday Spoken English',
    categoryId: 'english',
    level: 'Beginner',
    summary:
      'Build everyday conversations, pronunciation and listening skills.',
    imageUrl:
      'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600&auto=format&fit=crop&q=80',
    featured: true,
    popular: true,
    resources: englishFormats,
    units: [
      'Daily Lessons',
      'Introductions',
      'Everyday conversations',
      'Speaking Practice',
    ],
  },
  {
    id: 'english-grammar',
    title: 'English Grammar Foundations',
    categoryId: 'english',
    level: 'Beginner',
    summary: 'Explore sentence structure, tenses and practical writing.',
    imageUrl:
      'https://images.unsplash.com/photo-1455390582262-044cdead277a?w=600&auto=format&fit=crop&q=80',
    featured: false,
    popular: true,
    resources: englishFormats,
    units: ['Parts of speech', 'Tenses', 'Sentence building'],
  },
  {
    id: 'class10-math',
    title: 'Class 10 Mathematics: Real Numbers',
    categoryId: 'schools',
    level: 'Intermediate',
    summary:
      'Explore the first chapter of Class 10 Mathematics with a structured learning path.',
    imageUrl:
      'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=600&auto=format&fit=crop&q=80',
    featured: true,
    popular: true,
    resources: schoolFormats,
    units: [
      'Chapter 1: Real Numbers',
      'Euclid division lemma',
      'Fundamental theorem of arithmetic',
    ],
  },
  {
    id: 'upsc-polity',
    title: 'UPSC: Indian Polity',
    categoryId: 'government',
    level: 'Intermediate',
    summary:
      'A General Studies learning path through the Indian Constitution and governance.',
    imageUrl:
      'https://images.unsplash.com/photo-1521587760476-6c12a4b040da?w=600&auto=format&fit=crop&q=80',
    featured: true,
    popular: false,
    resources: examFormats,
    units: ['Constitutional framework', 'Fundamental rights', 'Parliament'],
  },
  {
    id: 'bca-programming',
    title: 'BCA: Programming Fundamentals',
    categoryId: 'colleges',
    level: 'Beginner',
    summary:
      'Semester 1 concepts in algorithms, programming and problem solving.',
    imageUrl:
      'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=600&auto=format&fit=crop&q=80',
    featured: false,
    popular: false,
    resources: collegeFormats,
    units: ['Unit 1: Algorithms', 'Variables and data types', 'Control flow'],
  },
  {
    id: 'python',
    title: 'Python for Beginners',
    categoryId: 'computers',
    level: 'Beginner',
    summary:
      'Discover Python through practical examples, exercises and a first project.',
    imageUrl:
      'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=600&auto=format&fit=crop&q=80',
    featured: true,
    popular: true,
    resources: computerFormats,
    units: [
      'Getting started',
      'Variables and types',
      'Loops and functions',
      'Your first project',
    ],
  },
  {
    id: 'excel',
    title: 'MS Excel Essentials',
    categoryId: 'computers',
    level: 'Beginner',
    summary: 'Learn spreadsheet fundamentals, formulas and working with data.',
    imageUrl:
      'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&auto=format&fit=crop&q=80',
    featured: false,
    popular: false,
    resources: computerFormats,
    units: ['Workbooks and cells', 'Formulas', 'Charts'],
  },
];

const slug = title =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
const node = (id, title, children = [], formats = []) => ({
  id,
  title,
  children,
  formats,
});
const courseNode = (id, title, courseId) => ({ ...node(id, title), courseId });

function schoolClasses(prefix) {
  return Array.from({ length: 12 }, (_, index) => {
    const grade = index + 1;
    const classId = `${prefix}-class-${grade}`;
    const subjects =
      grade > 10
        ? [
            'Mathematics',
            'Physics',
            'Chemistry',
            'Biology',
            'English',
            'Commerce',
          ]
        : ['Mathematics', 'English', 'Science', 'Social Science'];
    return node(
      classId,
      `Class ${grade}`,
      subjects.map(subject => {
        const subjectId = `${classId}-${slug(subject)}`;
        const chapters =
          grade === 10 && subject === 'Mathematics'
            ? [
                courseNode(
                  `${subjectId}-chapter-1`,
                  'Chapter 1: Real Numbers',
                  'class10-math',
                ),
              ]
            : [];
        return node(subjectId, subject, chapters, schoolFormats);
      }),
      schoolFormats,
    );
  });
}

const englishTopics = [
  'Basic English',
  'Spoken English',
  'English Grammar',
  'Vocabulary',
  'English Speaking Practice',
  'Reading and Writing',
  'Listening Skills',
  'Pronunciation',
  'Business English',
  'Interview Preparation',
  'IELTS / TOEFL',
];
const english = node(
  'english',
  'English Learning',
  englishTopics.map(topic => {
    const topicId = `english-${slug(topic)}`;
    return node(
      topicId,
      topic,
      ['Beginner', 'Intermediate', 'Advanced'].map(level => {
        const levelId = `${topicId}-${slug(level)}`;
        const linkedCourse =
          level === 'Beginner'
            ? {
                'Spoken English': 'spoken-english',
                'English Grammar': 'english-grammar',
              }[topic]
            : undefined;
        return node(
          levelId,
          level,
          linkedCourse
            ? [
                courseNode(
                  `${levelId}-daily-lessons`,
                  'Daily Lessons',
                  linkedCourse,
                ),
              ]
            : [],
          englishFormats,
        );
      }),
      englishFormats,
    );
  }),
);
english.description = 'Speak, write and connect with confidence.';

const schools = node('schools', 'All Schools', [
  ...['CBSE', 'ICSE', 'State Boards'].map(board =>
    node(
      `schools-${slug(board)}`,
      board,
      schoolClasses(`schools-${slug(board)}`),
    ),
  ),
  ...schoolClasses('schools'),
]);
schools.description = 'Every class. Every subject. A stronger foundation.';

const examNames = [
  'UPSC',
  'State PSC',
  'SSC CGL',
  'SSC CHSL',
  'SSC MTS',
  'Banking Exams',
  'IBPS PO',
  'SBI PO',
  'Railway Exams',
  'RRB NTPC',
  'RRB Group D',
  'Police Exams',
  'Defence Exams',
  'NDA',
  'CDS',
  'AFCAT',
  'CTET',
  'State Government Exams',
];
const government = node(
  'government',
  'Government Entrance Exams',
  examNames.map(exam => {
    const examId = `government-${slug(exam)}`;
    return node(
      examId,
      exam,
      ['General Studies', 'Quantitative Aptitude', 'Reasoning', 'English'].map(
        subject => {
          const subjectId = `${examId}-${slug(subject)}`;
          return node(
            subjectId,
            subject,
            exam === 'UPSC' && subject === 'General Studies'
              ? [
                  courseNode(
                    `${subjectId}-indian-polity`,
                    'Indian Polity',
                    'upsc-polity',
                  ),
                ]
              : [],
            examFormats,
          );
        },
      ),
      examFormats,
    );
  }),
);
government.description = 'Focused paths for your next competitive exam.';

const degrees = [
  'BCA',
  'BBA',
  'B.Tech',
  'B.Sc',
  'B.Com',
  'BA',
  'B.Pharm',
  'MCA',
  'MBA',
  'M.Tech',
  'M.Sc',
  'M.Com',
  'Other degree programs',
];
const colleges = node(
  'colleges',
  'Colleges',
  degrees.map(degree => {
    const degreeId = `colleges-${slug(degree)}`;
    const semesters = degree.startsWith('M')
      ? 4
      : ['B.Tech', 'B.Pharm'].includes(degree)
      ? 8
      : 6;
    return node(
      degreeId,
      degree,
      Array.from({ length: semesters }, (_, index) => {
        const semesterId = `${degreeId}-semester-${index + 1}`;
        return node(
          semesterId,
          `Semester ${index + 1}`,
          degree === 'BCA' && index === 0
            ? [
                courseNode(
                  `${semesterId}-programming`,
                  'Programming Fundamentals',
                  'bca-programming',
                ),
              ]
            : [
                node(`${semesterId}-core`, 'Core subjects', [], collegeFormats),
                node(
                  `${semesterId}-electives`,
                  'Electives',
                  [],
                  collegeFormats,
                ),
              ],
          collegeFormats,
        );
      }),
      collegeFormats,
    );
  }),
);
colleges.description = 'Semester-ready learning for your degree.';

const computerGroups = [
  {
    title: 'Computer Fundamentals',
    topics: [
      'Computer Basics',
      'MS Word',
      'MS Excel',
      'MS PowerPoint',
      'Internet Basics',
      'Operating Systems',
    ],
  },
  {
    title: 'Programming',
    topics: [
      'C',
      'C++',
      'Java',
      'Python',
      'JavaScript',
      'Ruby',
      'Ruby on Rails',
      'PHP',
    ],
  },
  {
    title: 'Web Development',
    topics: [
      'HTML',
      'CSS',
      'React.js',
      'Node.js',
      'Angular',
      'Full Stack Development',
    ],
  },
  {
    title: 'Advanced Technology',
    topics: [
      'Artificial Intelligence',
      'Machine Learning',
      'Generative AI',
      'Data Science',
      'Cybersecurity',
      'Cloud Computing',
      'Database Management',
      'DevOps',
    ],
  },
];
const computers = node(
  'computers',
  'Computer Learning',
  computerGroups.map(group => {
    const groupId = `computers-${slug(group.title)}`;
    return node(
      groupId,
      group.title,
      group.topics.map((topic, index) => {
        const topicId = `${groupId}-${index}-${slug(topic)}`;
        const linkedCourse = { Python: 'python', 'MS Excel': 'excel' }[topic];
        return node(
          topicId,
          topic,
          linkedCourse
            ? [
                courseNode(
                  `${topicId}-course`,
                  courses.find(course => course.id === linkedCourse).title,
                  linkedCourse,
                ),
              ]
            : [],
          computerFormats,
        );
      }),
      computerFormats,
    );
  }),
);
computers.description = 'Build practical skills, from basics to technology.';

module.exports = {
  version: 1,
  contentStatus: 'preview',
  categories: [english, schools, government, colleges, computers],
  courses,
};
