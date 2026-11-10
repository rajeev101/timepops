const transitions = {
  not_started: ['in_progress', 'ai_translated'],
  in_progress: ['under_review', 'ai_translated'],
  ai_translated: ['under_review'],
  under_review: ['approved', 'rejected'],
  approved: ['published', 'in_progress'],
  published: ['in_progress'],
  rejected: ['in_progress'],
};
function canTransition(previous, next) {
  return transitions[previous]?.includes(next) ?? false;
}
module.exports = { canTransition };
