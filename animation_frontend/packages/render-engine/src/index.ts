/**
 * @tooscut/render-engine
 *
 * Timeline model and frame building for Animato's editor (plan 10). Pure
 * TypeScript: types, keyframe evaluation, clip operations and render-frame
 * building. The GPU compositor and audio engine live in the app's single
 * animato-wasm build (plan 18.2); the package's own compositor, audio engine,
 * worklet and frame loader were removed after the plan 10.4 measurements.
 *
 * Architecture:
 * - Stateless design for parallel rendering across web workers
 * - Keyframes evaluated in pure JS before sending to GPU compositor
 * - Compositor uses WASM/WebGPU for hardware-accelerated rendering
 *
 */

// Types
export * from './types.js'

// Keyframe evaluation (pure TypeScript)
export {
  KeyframeEvaluator,
  evaluateTrack,
  evaluateCubicBezier,
  evaluateEasing,
  createLinearKeyframe,
  createStepKeyframe,
  createBezierKeyframe,
  createEasedKeyframe,
  createCustomBezierKeyframe,
  CUBIC_BEZIER_PRESETS,
} from './keyframe-evaluator.js'

// Frame building
export {
  EvaluatorManager,
  isClipVisible,
  getVisibleClips,
  getVisibleClipsWithTransitions,
  buildMediaLayerData,
  buildMediaLayerDataSync,
  buildRenderFrame,
  buildRenderFrameSync,
  type ClipBounds,
  type CrossTransitionRef,
  type Track,
  type TimelineClip,
  type BuildRenderFrameOptions,
} from './frame-builder.js'

// Clip operations (edit-time utilities)
export {
  // Binary search utilities
  findInsertionIndex,
  findClipById,
  sortClipsByStartTime,
  // Clip CRUD
  addClip,
  addClips,
  removeClip,
  removeClipWithLinked,
  updateClip,
  // Movement
  moveClip,
  moveClipToTrack,
  // Trimming
  trimClipLeft,
  trimClipRight,
  // Splitting
  splitClip,
  splitClipWithLinked,
  // Linking
  linkClips,
  unlinkClip,
  // Cross transitions
  addCrossTransition,
  removeCrossTransition,
  removeCrossTransitionsForClip,
  // Track operations
  addTrackPair,
  removeTrackPair,
  reorderTrackPair,
  updateTrack,
  muteTrackPair,
  lockTrackPair,
  findTrackById,
  getPairedTrack,
  getVideoTracksSorted,
  getAudioTracks,
  validateTracks,
  // Validation
  isClipsSorted,
  findOverlappingClips,
  canPlaceClip,
  // Types
  type EditableClip,
  type EditableTrack,
  type TrackPairResult,
  type SplitResult,
  type AddClipOptions,
  type MoveClipOptions,
  type TrimClipOptions,
} from './clip-operations.js'
