/* tslint:disable */
/* eslint-disable */
/**
 * Runs once when the module is instantiated.
 */
export function start(): void;
/**
 * Version string shown in the editor's performance badge.
 */
export function engine_version(): string;
/**
 * `HH:MM:SS:FF` for a time in seconds at `fps`.
 */
export function seconds_to_timecode(seconds: number, fps: number): string;
/**
 * Seconds for an `HH:MM:SS:FF` (or `MM:SS:FF`) timecode, or `NaN`.
 */
export function timecode_to_seconds(timecode: string, fps: number): number;
/**
 * Value of a keyframed property at `time`, evaluated by `tooscut-keyframe`.
 * Input: `[{time, value, ease}]` where `ease` is `linear`, `step`,
 * `easeIn`, `easeOut` or `easeInOut`.
 */
export function keyframe_value(keys_json: string, time: number): number;
/**
 * The target nearest to `time` if it lies within `threshold`, else `time`.
 */
export function snap(time: number, targets: Float64Array, threshold: number): number;
/**
 * Splits the clip at timeline time `at`. The right half gets `new_id`.
 * Returns the timeline unchanged when `at` is not inside the clip.
 */
export function split_clip(timeline: string, clip_id: string, at: number, new_id: string): string;
/**
 * Moves one edge of a clip to timeline time `to`. `edge` is `"start"` or
 * `"end"`. Trimming the start also advances the clip's source offset.
 */
export function trim_clip(timeline: string, clip_id: string, edge: string, to: number): string;
/**
 * Removes a clip and pulls every later clip on its track left to close the gap.
 */
export function ripple_delete(timeline: string, clip_id: string): string;
/**
 * Cues from SubRip text, as JSON `[{start, end, text}]` in seconds.
 * Malformed blocks are skipped.
 */
export function parse_srt(text: string): string;
/**
 * SubRip text for JSON cues `[{start, end, text}]`.
 */
export function to_srt(cues_json: string): string;
/**
 * Caption cues from timed words, one cue per sentence, using the transcript
 * normalizer from `offcut-text`. Input: `[{text, startMs, endMs, confidence}]`.
 */
export function captions_from_words(words_json: string): string;
/**
 * Peak absolute amplitude of `pcm` in `buckets` equal slices, each in 0..=1.
 */
export function waveform_peaks(pcm: Float32Array, buckets: number): Float32Array;
/**
 * The version of this crate, so the page can tell which bundle it loaded.
 */
export function core_version(): string;
/**
 * `raw` is an array of `{ text, startMs, endMs, confidence }` (TS §16.2),
 * with whole milliseconds. Anything else is a fault of the caller.
 */
export function normalize_transcript(raw: any, model_version: string): any;
/**
 * Throws `{ rejected }` for a file that is not an MP4 or MOV this version
 * reads, and `{ code, detail }` when the file itself cannot be read.
 */
export function open_demuxer(handle: FileSystemSyncAccessHandle): DemuxerHandle;
/**
 * `{ ok: ClipInfo }` or `{ rejected: RejectReason }`.
 */
export function probe_and_validate(d: DemuxerHandle, file_size: number, decode_supported: boolean): any;
export function resample(input: Float32Array, from_hz: number, to_hz: number): Float32Array;
/**
 * Evaluate a single keyframe track at the given time.
 *
 * This is a convenience function for one-off evaluations.
 * For repeated evaluations, use `KeyframeEvaluator` which caches
 * the last index for better performance.
 */
export function evaluate_track(track: any, time: number): number;
/**
 * Types of cross-transitions between clips.
 */
export enum CrossTransitionType {
  Dissolve = 0,
  Fade = 1,
  WipeLeft = 2,
  WipeRight = 3,
  WipeUp = 4,
  WipeDown = 5,
}
/**
 * Common easing presets.
 */
export enum EasingPreset {
  Linear = 0,
  EaseIn = 1,
  EaseOut = 2,
  EaseInOut = 3,
  Custom = 4,
}
/**
 * Animatable effect property names.
 *
 * Used for keyframe animation targeting.
 */
export enum EffectProperty {
  Opacity = 0,
  Brightness = 1,
  Contrast = 2,
  Saturation = 3,
  HueRotate = 4,
  Blur = 5,
}
/**
 * Interpolation mode between keyframes.
 */
export enum Interpolation {
  /**
   * Linear interpolation between values.
   */
  Linear = 0,
  /**
   * Hold previous value until next keyframe (step function).
   */
  Step = 1,
  /**
   * Cubic bezier interpolation with custom easing.
   */
  Bezier = 2,
}
/**
 * Line endpoint head types.
 */
export enum LineHeadType {
  None = 0,
  Arrow = 1,
  Circle = 2,
  Square = 3,
  Diamond = 4,
}
/**
 * Line stroke style.
 */
export enum LineStrokeStyle {
  Solid = 0,
  Dashed = 1,
  Dotted = 2,
}
/**
 * Primitive shape types.
 *
 * - Rectangle: 4-sided shape with optional corner radius (square is equal width/height)
 * - Ellipse: Oval shape (circle is equal width/height)
 * - Polygon: N-sided regular polygon defined by number of sides
 */
export enum ShapeType {
  Rectangle = 0,
  Ellipse = 1,
  Polygon = 2,
}
/**
 * Text alignment.
 */
export enum TextAlign {
  Left = 0,
  Center = 1,
  Right = 2,
}
/**
 * Types of transitions available.
 */
export enum TransitionType {
  None = 0,
  Fade = 1,
  Dissolve = 2,
  WipeLeft = 3,
  WipeRight = 4,
  WipeUp = 5,
  WipeDown = 6,
  SlideLeft = 7,
  SlideRight = 8,
  SlideUp = 9,
  SlideDown = 10,
  ZoomIn = 11,
  ZoomOut = 12,
  RotateCw = 13,
  RotateCcw = 14,
  FlipH = 15,
  FlipV = 16,
}
/**
 * Vertical alignment for text within its box.
 */
export enum VerticalAlign {
  Top = 0,
  Middle = 1,
  Bottom = 2,
}
/**
 * A transition effect applied to a clip\'s in or out point.
 */
export interface Transition {
    /**
     * The type of transition effect.
     */
    type: TransitionType;
    /**
     * Duration of the transition in seconds.
     */
    duration: number;
    /**
     * Easing curve for the transition.
     */
    easing: Easing;
}

/**
 * A cross-transition configuration (type, duration, easing).
 *
 * The clip references (IDs) are stored separately in the editor layer.
 */
export interface CrossTransition {
    /**
     * Type of cross-transition.
     */
    type: CrossTransitionType;
    /**
     * Duration of the overlap in seconds.
     */
    duration: number;
    /**
     * Easing curve for the transition.
     */
    easing: Easing;
}

/**
 * Color space for processing.
 *
 * All internal processing happens in linear space with appropriate
 * conversions at input/output boundaries.
 */
export type ColorSpace = "Srgb" | "Linear" | "AcesCg" | "LogC" | "SLog2" | "SLog3" | "CLog3" | "VLog" | "BmFilm" | "RedLog3G10";

/**
 * Tone mapping method for dynamic range compression.
 *
 * When converting from wide-DR log footage to a display-referred space,
 * tone mapping smoothly compresses highlights to avoid hard clipping.
 */
export type ToneMapping = "None" | "Simple";

/**
 * Color gamut (primary) for gamut mapping.
 *
 * Separate from the transfer function (ColorSpace). When source footage
 * uses wide-gamut primaries (e.g. S-Gamut), converting the gamut to
 * Rec.709 is necessary in addition to the transfer function conversion.
 */
export type Gamut = "Rec709" | "SGamut" | "SGamut3" | "SGamut3Cine" | "ArriWideGamut" | "AcesCgAp1" | "RedWideGamut" | "DciP3" | "Rec2020" | "VGamut" | "BmdWideGamut";

/**
 * Primary color correction using ASC-CDL (Color Decision List) model.
 *
 * The CDL formula is: `output = (input * slope + offset) ^ power`
 *
 * This is compatible with industry-standard CDL interchange formats.
 */
export interface PrimaryCorrection {
    /**
     * Slope (gain) per channel - multiplier applied before offset.
     * Default: [1.0, 1.0, 1.0]
     */
    slope: [number, number, number];
    /**
     * Offset (lift) per channel - added after slope multiplication.
     * Default: [0.0, 0.0, 0.0]
     */
    offset: [number, number, number];
    /**
     * Power (gamma) per channel - applied after slope and offset.
     * Default: [1.0, 1.0, 1.0]
     */
    power: [number, number, number];
    /**
     * Global saturation multiplier.
     * 0.0 = grayscale, 1.0 = normal, 2.0 = double saturation.
     */
    saturation: number;
    /**
     * Exposure adjustment in EV stops (-4.0 to +4.0).
     */
    exposure: number;
    /**
     * Color temperature offset in Kelvin.
     * Positive = warmer (yellow), negative = cooler (blue).
     */
    temperature: number;
    /**
     * Tint adjustment (green-magenta axis).
     * Positive = magenta, negative = green.
     */
    tint: number;
    /**
     * Highlight recovery (-1.0 to 1.0).
     * Positive compresses highlights, negative expands.
     */
    highlights: number;
    /**
     * Shadow adjustment (-1.0 to 1.0).
     * Positive lifts shadows, negative crushes.
     */
    shadows: number;
}

/**
 * Shape type for power windows.
 */
export type PowerWindowShape = { Circle: { radius_x: number; radius_y: number } } | { Rectangle: { width: number; height: number; corner_radius: number } } | { Gradient: { angle: number } } | { Polygon: { points: [number, number][] } };

/**
 * Power window for regional color corrections.
 */
export interface PowerWindow {
    /**
     * Window shape.
     */
    shape: PowerWindowShape;
    /**
     * Center X position (0.0-1.0, fraction of frame width).
     */
    center_x: number;
    /**
     * Center Y position (0.0-1.0, fraction of frame height).
     */
    center_y: number;
    /**
     * Horizontal scale multiplier.
     */
    scale_x: number;
    /**
     * Vertical scale multiplier.
     */
    scale_y: number;
    /**
     * Rotation in degrees.
     */
    rotation: number;
    /**
     * Inner edge softness (0.0-1.0).
     */
    softness_inner: number;
    /**
     * Outer edge softness (0.0-1.0).
     */
    softness_outer: number;
    /**
     * Invert the window mask.
     */
    invert: boolean;
}

/**
 * Node position in the graph editor.
 */
export interface NodePosition {
    x: number;
    y: number;
}

/**
 * A node in the color grading pipeline.
 */
export type ColorGradingNode = { type: "Primary"; id: string; enabled: boolean; mix: number; label?: string; position?: NodePosition; correction: PrimaryCorrection } | { type: "ColorWheels"; id: string; enabled: boolean; mix: number; label?: string; position?: NodePosition; wheels: ColorWheels } | { type: "Curves"; id: string; enabled: boolean; mix: number; label?: string; position?: NodePosition; curves: Curves } | { type: "Lut"; id: string; enabled: boolean; mix: number; label?: string; position?: NodePosition; lut: LutReference } | { type: "Qualifier"; id: string; enabled: boolean; mix: number; label?: string; position?: NodePosition; qualifier: HslQualifier; correction: PrimaryCorrection } | { type: "Window"; id: string; enabled: boolean; mix: number; label?: string; position?: NodePosition; window: PowerWindow; correction: PrimaryCorrection } | { type: "ColorSpaceTransform"; id: string; enabled: boolean; mix: number; label?: string; position?: NodePosition; from_space: ColorSpace; to_space: ColorSpace; from_gamut?: Gamut; to_gamut?: Gamut; tone_mapping?: ToneMapping };

/**
 * Complete color grading configuration for a media layer.
 */
export interface ColorGrading {
    /**
     * Input color space (for LOG footage, etc.).
     */
    input_color_space: ColorSpace;
    /**
     * Output color space.
     */
    output_color_space: ColorSpace;
    /**
     * Node pipeline executed in order.
     */
    nodes: ColorGradingNode[];
    /**
     * Bypass all color grading.
     */
    bypass: boolean;
}

/**
 * A color wheel value represented as polar coordinates.
 *
 * Used for lift/gamma/gain color adjustments.
 */
export interface ColorWheelValue {
    /**
     * Hue angle in degrees (0-360).
     */
    angle: number;
    /**
     * Distance from center (0.0-1.0), representing color intensity.
     */
    distance: number;
}

/**
 * Color wheels for lift/gamma/gain adjustment.
 *
 * - **Lift**: Adjusts shadows (dark areas)
 * - **Gamma**: Adjusts midtones
 * - **Gain**: Adjusts highlights (bright areas)
 */
export interface ColorWheels {
    /**
     * Lift wheel (shadows).
     */
    lift: ColorWheelValue;
    /**
     * Gamma wheel (midtones).
     */
    gamma: ColorWheelValue;
    /**
     * Gain wheel (highlights).
     */
    gain: ColorWheelValue;
    /**
     * Lift luminance adjustment (-1.0 to 1.0).
     */
    lift_luminance: number;
    /**
     * Gamma luminance adjustment (-1.0 to 1.0).
     */
    gamma_luminance: number;
    /**
     * Gain luminance adjustment (-1.0 to 1.0).
     */
    gain_luminance: number;
}

/**
 * A point on a curve with optional tangent handles.
 */
export interface CurvePoint {
    /**
     * Input value (0.0-1.0).
     */
    x: number;
    /**
     * Output value (0.0-1.0).
     */
    y: number;
}

/**
 * A 1D curve defined by control points.
 *
 * Points are interpolated using monotonic cubic splines to ensure
 * smooth, well-behaved curves without overshooting.
 */
export interface Curve1D {
    /**
     * Control points sorted by x coordinate.
     */
    points: CurvePoint[];
}

/**
 * RGB curves plus advanced curve types.
 */
export interface Curves {
    /**
     * Master curve (affects all channels equally).
     */
    master: Curve1D;
    /**
     * Red channel curve.
     */
    red: Curve1D;
    /**
     * Green channel curve.
     */
    green: Curve1D;
    /**
     * Blue channel curve.
     */
    blue: Curve1D;
    /**
     * Hue vs Saturation curve (optional).
     * X = input hue (0-1 maps to 0-360°), Y = saturation multiplier.
     */
    hue_vs_sat?: Curve1D;
    /**
     * Hue vs Hue curve (optional).
     * X = input hue, Y = hue rotation offset.
     */
    hue_vs_hue?: Curve1D;
    /**
     * Hue vs Luminance curve (optional).
     * X = input hue, Y = luminance multiplier.
     */
    hue_vs_lum?: Curve1D;
    /**
     * Luminance vs Saturation curve (optional).
     * X = input luminance, Y = saturation multiplier.
     */
    lum_vs_sat?: Curve1D;
    /**
     * Saturation vs Saturation curve (optional).
     * X = input saturation, Y = saturation multiplier.
     */
    sat_vs_sat?: Curve1D;
}

/**
 * Reference to a loaded 3D LUT.
 */
export interface LutReference {
    /**
     * Unique ID of the loaded LUT.
     */
    lut_id: string;
    /**
     * Interpolation method.
     */
    interpolation: LutInterpolation;
    /**
     * Mix amount (0.0 = original, 1.0 = full LUT effect).
     */
    mix: number;
}

/**
 * LUT interpolation method.
 */
export type LutInterpolation = "Trilinear" | "Tetrahedral";

/**
 * HSL qualifier for isolating specific colors.
 *
 * Creates a mask based on hue, saturation, and luminance ranges,
 * which can then be used to apply corrections to specific color regions.
 */
export interface HslQualifier {
    /**
     * Center hue (0-360 degrees).
     */
    hue_center: number;
    /**
     * Center saturation (0.0-1.0).
     */
    saturation_center: number;
    /**
     * Center luminance (0.0-1.0).
     */
    luminance_center: number;
    /**
     * Hue selection width (0-180 degrees).
     */
    hue_width: number;
    /**
     * Saturation selection width (0.0-1.0).
     */
    saturation_width: number;
    /**
     * Luminance selection width (0.0-1.0).
     */
    luminance_width: number;
    /**
     * Hue edge softness (0.0-1.0).
     */
    hue_softness: number;
    /**
     * Saturation edge softness (0.0-1.0).
     */
    saturation_softness: number;
    /**
     * Luminance edge softness (0.0-1.0).
     */
    luminance_softness: number;
    /**
     * Invert the qualifier mask.
     */
    invert: boolean;
}

/**
 * Text style configuration.
 */
export interface TextStyle {
    /**
     * Font family name (must be loaded).
     */
    font_family: string;
    /**
     * Font size in pixels.
     */
    font_size: number;
    /**
     * Font weight (100-900, where 400=normal, 700=bold).
     */
    font_weight: number;
    /**
     * Whether text is italic.
     */
    italic: boolean;
    /**
     * Text color (RGBA 0-1).
     */
    color: [number, number, number, number];
    /**
     * Horizontal alignment.
     */
    text_align: TextAlign;
    /**
     * Vertical alignment within the box.
     */
    vertical_align: VerticalAlign;
    /**
     * Line height multiplier (1.0 = normal).
     */
    line_height: number;
    /**
     * Letter spacing in pixels.
     */
    letter_spacing: number;
    /**
     * Background color (RGBA 0-1).
     */
    background_color?: [number, number, number, number];
    /**
     * Background padding in pixels.
     */
    background_padding?: number;
    /**
     * Background border radius in pixels.
     */
    background_border_radius?: number;
}

/**
 * Text bounding box (position and size as percentages 0-100 of canvas).
 */
export interface TextBox {
    /**
     * X position (percentage of canvas width).
     */
    x: number;
    /**
     * Y position (percentage of canvas height).
     */
    y: number;
    /**
     * Width (percentage of canvas width).
     */
    width: number;
    /**
     * Height (percentage of canvas height).
     */
    height: number;
}

/**
 * Karaoke-style word highlight configuration.
 */
export interface HighlightStyle {
    /**
     * Override text color for highlighted words (RGBA 0-1).
     */
    color?: [number, number, number, number];
    /**
     * Override background color for highlighted words (RGBA 0-1).
     */
    background_color?: [number, number, number, number];
    /**
     * Override background padding.
     */
    background_padding?: number;
    /**
     * Override border radius.
     */
    background_border_radius?: number;
    /**
     * Override font weight.
     */
    font_weight?: number;
    /**
     * Scale factor for highlighted words.
     */
    scale?: number;
}

/**
 * Text layer data for rendering.
 *
 * All values are pre-evaluated (keyframes resolved before sending to compositor).
 * This allows stateless, parallel rendering across web workers.
 */
export interface TextLayerData {
    /**
     * Unique identifier.
     */
    id: string;
    /**
     * The text content to render.
     */
    text: string;
    /**
     * Bounding box (position and size as percentages).
     */
    box: TextBox;
    /**
     * Text styling.
     */
    style: TextStyle;
    /**
     * Stacking order (higher = on top).
     */
    z_index: number;
    /**
     * Overall opacity (0.0-1.0).
     */
    opacity: number;
    /**
     * Highlight style for karaoke effect.
     */
    highlight_style?: HighlightStyle;
    /**
     * Word indices that are currently highlighted (0-based).
     */
    highlighted_word_indices?: number[];
    /**
     * Transition in effect.
     */
    transition_in?: ActiveTransition;
    /**
     * Transition out effect.
     */
    transition_out?: ActiveTransition;
}

/**
 * Data for rendering a video/image layer.
 *
 * All transform and effects values are pre-evaluated (keyframes resolved in JS).
 * This allows stateless, parallel rendering across web workers.
 */
export interface MediaLayerData {
    /**
     * Unique texture ID for this layer\'s content.
     */
    texture_id: string;
    /**
     * Transform (position, scale, rotation) - pre-evaluated.
     */
    transform: Transform;
    /**
     * Visual effects - pre-evaluated.
     */
    effects: Effects;
    /**
     * Stacking order (higher = on top).
     */
    z_index: number;
    /**
     * Crop region.
     */
    crop?: Crop;
    /**
     * Transition in effect.
     */
    transition_in?: ActiveTransition;
    /**
     * Transition out effect.
     */
    transition_out?: ActiveTransition;
    /**
     * Cross-transition with adjacent clip (only one can be active).
     */
    cross_transition?: ActiveCrossTransition;
    /**
     * Color grading configuration.
     */
    color_grading?: ColorGrading;
}

/**
 * An active transition with its current progress.
 */
export interface ActiveTransition {
    /**
     * The transition configuration.
     */
    transition: Transition;
    /**
     * Current progress (0.0-1.0, before easing is applied).
     */
    progress: number;
}

/**
 * An active cross-transition between two clips.
 */
export interface ActiveCrossTransition {
    /**
     * The cross-transition configuration.
     */
    cross_transition: CrossTransition;
    /**
     * Current progress (0.0-1.0, before easing is applied).
     */
    progress: number;
    /**
     * Whether this layer is the outgoing clip (true) or incoming (false).
     */
    is_outgoing: boolean;
}

/**
 * Render frame request containing all layer types.
 *
 * All layer types share the same transition system (transition_in, transition_out).
 * The compositor applies transitions uniformly regardless of layer type.
 */
export interface RenderFrame {
    /**
     * Media layers (video/image clips).
     */
    media_layers: MediaLayerData[];
    /**
     * Text layers.
     */
    text_layers: TextLayerData[];
    /**
     * Shape layers (rectangle, ellipse, polygon).
     */
    shape_layers: ShapeLayerData[];
    /**
     * Line layers.
     */
    line_layers: LineLayerData[];
    /**
     * Current timeline time in seconds.
     */
    timeline_time: number;
    /**
     * Canvas width in pixels.
     */
    width: number;
    /**
     * Canvas height in pixels.
     */
    height: number;
}

/**
 * Shape bounding box (position and size as percentages 0-100 of canvas).
 */
export interface ShapeBox {
    /**
     * X position (percentage of canvas width).
     */
    x: number;
    /**
     * Y position (percentage of canvas height).
     */
    y: number;
    /**
     * Width (percentage of canvas width).
     */
    width: number;
    /**
     * Height (percentage of canvas height).
     */
    height: number;
}

/**
 * Shape style properties.
 */
export interface ShapeStyle {
    /**
     * Fill color (RGBA 0-1).
     */
    fill: [number, number, number, number];
    /**
     * Stroke (outline) color (RGBA 0-1).
     */
    stroke?: [number, number, number, number];
    /**
     * Stroke width in pixels.
     */
    stroke_width: number;
    /**
     * Corner radius for rectangles.
     */
    corner_radius: number;
    /**
     * Number of sides for polygons (3 = triangle, 5 = pentagon, etc.).
     */
    sides?: number;
}

/**
 * Shape layer data for rendering.
 *
 * All values are pre-evaluated (keyframes resolved before sending to compositor).
 */
export interface ShapeLayerData {
    /**
     * Unique identifier.
     */
    id: string;
    /**
     * Shape type.
     */
    shape: ShapeType;
    /**
     * Bounding box (position and size as percentages).
     */
    box: ShapeBox;
    /**
     * Shape styling.
     */
    style: ShapeStyle;
    /**
     * Stacking order (higher = on top).
     */
    z_index: number;
    /**
     * Overall opacity (0.0-1.0).
     */
    opacity: number;
    /**
     * Transition in effect.
     */
    transition_in?: ActiveTransition;
    /**
     * Transition out effect.
     */
    transition_out?: ActiveTransition;
}

/**
 * Line endpoint configuration.
 */
export interface LineEndpoint {
    /**
     * Type of endpoint decoration.
     */
    type: LineHeadType;
    /**
     * Size of the decoration in pixels.
     */
    size: number;
}

/**
 * Line endpoints (as percentages 0-100 of canvas).
 */
export interface LineBox {
    /**
     * Start X position (percentage of canvas width).
     */
    x1: number;
    /**
     * Start Y position (percentage of canvas height).
     */
    y1: number;
    /**
     * End X position (percentage of canvas width).
     */
    x2: number;
    /**
     * End Y position (percentage of canvas height).
     */
    y2: number;
}

/**
 * Line style properties.
 */
export interface LineStyle {
    /**
     * Stroke color (RGBA 0-1).
     */
    stroke: [number, number, number, number];
    /**
     * Stroke width in pixels.
     */
    stroke_width: number;
    /**
     * Stroke style.
     */
    stroke_style: LineStrokeStyle;
    /**
     * Start endpoint decoration.
     */
    start_head: LineEndpoint;
    /**
     * End endpoint decoration.
     */
    end_head: LineEndpoint;
}

/**
 * Line layer data for rendering.
 *
 * All values are pre-evaluated (keyframes resolved before sending to compositor).
 */
export interface LineLayerData {
    /**
     * Unique identifier.
     */
    id: string;
    /**
     * Line endpoints (as percentages).
     */
    box: LineBox;
    /**
     * Line styling.
     */
    style: LineStyle;
    /**
     * Stacking order (higher = on top).
     */
    z_index: number;
    /**
     * Overall opacity (0.0-1.0).
     */
    opacity: number;
    /**
     * Transition in effect.
     */
    transition_in?: ActiveTransition;
    /**
     * Transition out effect.
     */
    transition_out?: ActiveTransition;
}

/**
 * Combined easing configuration.
 */
export interface Easing {
    preset: EasingPreset;
    custom_bezier?: CubicBezier;
}

/**
 * Visual effects that can be applied to any layer.
 *
 * All values use intuitive ranges where 1.0 is the default/neutral.
 */
export interface Effects {
    /**
     * Opacity (0.0 = transparent, 1.0 = opaque).
     */
    opacity: number;
    /**
     * Brightness multiplier (1.0 = normal).
     */
    brightness: number;
    /**
     * Contrast multiplier (1.0 = normal).
     */
    contrast: number;
    /**
     * Saturation multiplier (0.0 = grayscale, 1.0 = normal, 2.0 = oversaturated).
     */
    saturation: number;
    /**
     * Hue rotation in degrees (0-360).
     */
    hue_rotate: number;
    /**
     * Gaussian blur radius in pixels.
     */
    blur: number;
}

/**
 * 2D transform for positioning layers on the canvas.
 *
 * Coordinates are in pixels relative to canvas origin (top-left).
 * Anchor point (0.0-1.0) determines the center of rotation/scale.
 */
export interface Transform {
    /**
     * X position in pixels.
     */
    x: number;
    /**
     * Y position in pixels.
     */
    y: number;
    /**
     * Horizontal scale (1.0 = 100%).
     */
    scale_x: number;
    /**
     * Vertical scale (1.0 = 100%).
     */
    scale_y: number;
    /**
     * Rotation in degrees (clockwise).
     */
    rotation: number;
    /**
     * Anchor X (0.0 = left, 0.5 = center, 1.0 = right).
     */
    anchor_x: number;
    /**
     * Anchor Y (0.0 = top, 0.5 = center, 1.0 = bottom).
     */
    anchor_y: number;
}

/**
 * Crop region in normalized coordinates (0.0-1.0).
 *
 * Each field represents how much to remove from that edge.
 */
export interface Crop {
    /**
     * Amount to crop from top (0.0-1.0).
     */
    top: number;
    /**
     * Amount to crop from right (0.0-1.0).
     */
    right: number;
    /**
     * Amount to crop from bottom (0.0-1.0).
     */
    bottom: number;
    /**
     * Amount to crop from left (0.0-1.0).
     */
    left: number;
}

/**
 * Audio Engine - main WASM export
 *
 * This struct wraps the AudioMixer and provides the public API for the AudioWorklet.
 */
export class AudioEngine {
  free(): void;
  /**
   * Set playback state
   */
  set_playing(playing: boolean): void;
  /**
   * Remove audio data for a source
   */
  remove_audio(source_id: string): void;
  /**
   * Update the timeline state (clips, tracks, cross-transitions)
   *
   * # Arguments
   * * `timeline_json` - JSON string containing AudioTimelineState
   */
  set_timeline(timeline_json: string): void;
  /**
   * Upload decoded PCM audio data for a clip
   *
   * # Arguments
   * * `source_id` - Unique identifier for this audio source (asset ID)
   * * `pcm_data` - Interleaved stereo PCM data (f32)
   * * `source_sample_rate` - Sample rate of the source audio
   * * `channels` - Number of channels (1 or 2)
   */
  upload_audio(source_id: string, pcm_data: Float32Array, source_sample_rate: number, channels: number): void;
  /**
   * Get the current playback time (for sync feedback)
   */
  get_current_time(): number;
  /**
   * Get buffer misses since last query (diagnostics)
   */
  get_buffer_misses(source_id: string): bigint;
  /**
   * Set master volume (0.0 - 1.0)
   */
  set_master_volume(volume: number): void;
  /**
   * Set global playback rate
   *
   * # Arguments
   * * `rate` - Playback rate multiplier (1.0 = normal, 2.0 = 2x, -1.0 = reverse)
   *
   * Note: Reverse playback outputs silence as audio cannot play backwards.
   */
  set_playback_rate(rate: number): void;
  /**
   * Clear all buffered data for a windowed source (used on seek)
   */
  clear_source_buffer(source_id: string): void;
  /**
   * Update the buffered PCM window for a windowed source
   *
   * # Arguments
   * * `source_id` - ID of the windowed source
   * * `start_time` - Start time in source-time seconds for this chunk
   * * `pcm_data` - Interleaved PCM data (f32)
   */
  update_source_buffer(source_id: string, start_time: number, pcm_data: Float32Array): void;
  /**
   * Create a windowed audio source (metadata only, fixed-size buffer)
   *
   * Unlike streaming sources, windowed sources only retain a limited amount
   * of decoded PCM in memory. The JS side manages decode-ahead and sends
   * buffer updates as the playhead moves.
   *
   * # Arguments
   * * `source_id` - Unique identifier for this audio source (asset ID)
   * * `sample_rate` - Sample rate of the source audio
   * * `channels` - Number of channels (1 or 2)
   * * `duration` - Total duration of the source media in seconds
   * * `max_buffer_seconds` - Maximum seconds of PCM to retain (e.g. 30.0)
   */
  create_windowed_source(source_id: string, sample_rate: number, channels: number, duration: number, max_buffer_seconds: number): void;
  /**
   * Update the sample rate for a source
   *
   * Used when the actual decoded sample rate differs from the container metadata
   * (e.g. HE-AAC files where probe reports 44100 but decoder outputs 48000).
   */
  update_source_sample_rate(source_id: string, sample_rate: number): void;
  /**
   * Create a new AudioEngine with the given output sample rate
   */
  constructor(sample_rate: number);
  /**
   * Seek to a specific time
   */
  seek(time: number): void;
  /**
   * Render audio frames
   *
   * Called from the AudioWorklet processor every ~128 samples.
   * Output is interleaved stereo (L, R, L, R, ...).
   *
   * # Arguments
   * * `output` - Mutable slice to write interleaved stereo samples
   * * `num_frames` - Number of stereo frames to render
   *
   * # Returns
   * Number of frames actually rendered
   */
  render(output: Float32Array, num_frames: number): number;
}
/**
 * RGBA color with components in 0.0-1.0 range.
 */
export class Color {
  free(): void;
  constructor(r: number, g: number, b: number, a: number);
  /**
   * Create an opaque RGB color.
   */
  static rgb(r: number, g: number, b: number): Color;
  /**
   * Convert to hex string with alpha (e.g., "#ff0000ff").
   */
  to_hex(): string;
  /**
   * Parse from hex string (e.g., "#ff0000" or "#ff0000ff").
   */
  static from_hex(hex: string): Color | undefined;
  r: number;
  g: number;
  b: number;
  a: number;
}
/**
 * GPU-accelerated video compositor.
 */
export class Compositor {
  private constructor();
  free(): void;
  /**
   * Create a new compositor from an HTML canvas element.
   */
  static from_canvas(canvas: HTMLCanvasElement): Promise<Compositor>;
  /**
   * Create a compositor for offscreen rendering.
   */
  static from_offscreen_canvas(canvas: OffscreenCanvas): Promise<Compositor>;
  /**
   * Render a frame and return the pixel data as RGBA bytes.
   * This bypasses the surface and renders to an internal texture for reliable readback.
   */
  render_to_pixels(frame: any): Promise<Uint8Array>;
  /**
   * Remove the active LUT, reverting to the identity (passthrough) LUT.
   */
  remove_lut(): void;
  /**
   * Upload a 3D LUT from RGBA float data.
   *
   * `data` must be a Float32Array with `size^3 * 4` elements (RGBA).
   * `size` is the cube dimension (e.g., 17, 33, 65).
   */
  upload_lut(lut_id: string, size: number, data: Float32Array): void;
  /**
   * Upload texture from an HTML video element.
   */
  upload_video(video: HTMLVideoElement, texture_id: string): void;
  /**
   * Upload texture from an ImageBitmap using zero-copy GPU transfer.
   *
   * This uses `copy_external_image_to_texture` for efficient GPU upload
   * without copying pixel data through JavaScript.
   */
  upload_bitmap(bitmap: ImageBitmap, texture_id: string): void;
  /**
   * Upload texture data from RGBA pixel array.
   */
  upload_rgba(texture_id: string, width: number, height: number, data: Uint8Array): void;
  /**
   * Clear a specific texture.
   */
  clear_texture(texture_id: string): void;
  /**
   * Render layers from a RenderFrame object.
   */
  render_layers(frame: any): void;
  /**
   * Get the number of loaded textures.
   */
  texture_count(): number;
  /**
   * Check if a font family has been loaded.
   */
  is_font_loaded(font_family: string): boolean;
  /**
   * Clear all textures.
   */
  clear_all_textures(): void;
  /**
   * Render a single layer by texture ID.
   */
  render_single_layer(texture_id: string, opacity: number): void;
  /**
   * Flush any pending GPU commands.
   */
  flush(): void;
  /**
   * Resize the compositor canvas.
   */
  resize(width: number, height: number): void;
  /**
   * Clean up resources.
   */
  dispose(): void;
  /**
   * Load a custom font from TTF/OTF data.
   *
   * The `font_family` should be the font's internal family name (e.g., "Roboto", "Open Sans").
   * Use this same name in text layer `fontFamily` to use this font.
   *
   * Returns true if the font was loaded, false if already loaded.
   */
  load_font(font_family: string, font_data: Uint8Array): boolean;
  /**
   * Get the canvas width.
   */
  readonly width: number;
  /**
   * Get the canvas height.
   */
  readonly height: number;
}
/**
 * Cubic bezier control points [x1, y1, x2, y2].
 * Controls the acceleration curve of animations and transitions.
 */
export class CubicBezier {
  free(): void;
  constructor(x1: number, y1: number, x2: number, y2: number);
  /**
   * Evaluate the bezier curve at progress t (0.0-1.0).
   * Uses Newton-Raphson iteration to find the curve parameter.
   */
  evaluate(t: number): number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}
export class DemuxerHandle {
  private constructor();
  free(): void;
  /**
   * The `AudioSpecificConfig`.
   */
  audio_description(): Uint8Array | undefined;
  /**
   * `{ data: Uint8Array, ptsUs: number, durationUs: number }`. The clip was
   * accepted before this is called, so a failure is an error, never a rejection.
   */
  read_audio_sample(index: number): any;
  /**
   * The raw `avcC` payload.
   */
  video_description(): Uint8Array | undefined;
  audio_sample_count(): number;
  /**
   * The `ProbeInfo`, for the decoder question that comes before validation.
   */
  probe(file_size: number): any;
}
/**
 * Keyframe evaluator with temporal coherence caching.
 *
 * During sequential playback (frame-by-frame), the current time typically
 * advances by a small delta. This evaluator caches the last keyframe index
 * for each property, allowing O(1) lookups when time moves forward slightly.
 *
 * When seeking (large time jumps), it falls back to binary search O(log n).
 */
export class KeyframeEvaluator {
  free(): void;
  /**
   * Get all animated property names.
   */
  properties(): any;
  /**
   * Clear the temporal cache (call after seeking).
   */
  clear_cache(): void;
  /**
   * Check if a property exists and has keyframes.
   */
  has_property(property: string): boolean;
  /**
   * Create a new evaluator from a KeyframeTracks object.
   */
  constructor(tracks: any);
  /**
   * Evaluate a property at the given time.
   *
   * Returns `None` (as NaN) if the property doesn't exist.
   */
  evaluate(property: string, time: number): number;
}
/**
 * An open MP4/MOV file in OPFS.
 */
export class Mp4Demuxer {
  private constructor();
  free(): void;
  /**
   * The `description` for `AudioDecoder.configure` (AudioSpecificConfig).
   */
  audio_description(): Uint8Array | undefined;
  /**
   * Audio sample `index`.
   */
  read_audio_sample(index: number): any;
  /**
   * Video sample `index` in decode order.
   */
  read_video_sample(index: number): any;
  /**
   * The `description` for `VideoDecoder.configure` (avcC / hvcC / av1C).
   */
  video_description(): Uint8Array | undefined;
  audio_sample_count(): number;
  video_sample_count(): number;
  /**
   * Index of the last keyframe shown at or before `t_ms`.
   */
  keyframe_at_or_before(t_ms: number): number;
  /**
   * The probe of the file: container, duration, codecs (WebCodecs codec
   * strings), size and frame rate.
   */
  info(): any;
  /**
   * Opens the file behind `handle`. Fails for fragmented or non-ISO-BMFF
   * files (the caller then falls back to another demuxer).
   */
  static open(handle: FileSystemSyncAccessHandle): Mp4Demuxer;
}
export class Sha256Stream {
  free(): void;
  /**
   * The digest as 64 lower-case hex digits. The stream is used up.
   */
  finalize_hex(): string;
  constructor();
  update(chunk: Uint8Array): void;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly __wbg_mp4demuxer_free: (a: number, b: number) => void;
  readonly captions_from_words: (a: number, b: number) => [number, number, number, number];
  readonly engine_version: () => [number, number];
  readonly keyframe_value: (a: number, b: number, c: number) => [number, number, number];
  readonly mp4demuxer_audio_description: (a: number) => [number, number];
  readonly mp4demuxer_audio_sample_count: (a: number) => number;
  readonly mp4demuxer_info: (a: number) => [number, number, number];
  readonly mp4demuxer_keyframe_at_or_before: (a: number, b: number) => number;
  readonly mp4demuxer_open: (a: any) => [number, number, number];
  readonly mp4demuxer_read_audio_sample: (a: number, b: number) => [number, number, number];
  readonly mp4demuxer_read_video_sample: (a: number, b: number) => [number, number, number];
  readonly mp4demuxer_video_description: (a: number) => [number, number];
  readonly mp4demuxer_video_sample_count: (a: number) => number;
  readonly parse_srt: (a: number, b: number) => [number, number, number, number];
  readonly ripple_delete: (a: number, b: number, c: number, d: number) => [number, number, number, number];
  readonly seconds_to_timecode: (a: number, b: number) => [number, number];
  readonly snap: (a: number, b: number, c: number, d: number) => number;
  readonly split_clip: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => [number, number, number, number];
  readonly start: () => void;
  readonly timecode_to_seconds: (a: number, b: number, c: number) => number;
  readonly to_srt: (a: number, b: number) => [number, number, number, number];
  readonly trim_clip: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => [number, number, number, number];
  readonly waveform_peaks: (a: number, b: number, c: number) => [number, number];
  readonly __wbg_compositor_free: (a: number, b: number) => void;
  readonly compositor_clear_all_textures: (a: number) => void;
  readonly compositor_clear_texture: (a: number, b: number, c: number) => void;
  readonly compositor_dispose: (a: number) => void;
  readonly compositor_flush: (a: number) => void;
  readonly compositor_from_canvas: (a: any) => any;
  readonly compositor_from_offscreen_canvas: (a: any) => any;
  readonly compositor_height: (a: number) => number;
  readonly compositor_is_font_loaded: (a: number, b: number, c: number) => number;
  readonly compositor_load_font: (a: number, b: number, c: number, d: number, e: number) => number;
  readonly compositor_remove_lut: (a: number) => void;
  readonly compositor_render_layers: (a: number, b: any) => [number, number];
  readonly compositor_render_single_layer: (a: number, b: number, c: number, d: number) => [number, number];
  readonly compositor_render_to_pixels: (a: number, b: any) => any;
  readonly compositor_resize: (a: number, b: number, c: number) => void;
  readonly compositor_texture_count: (a: number) => number;
  readonly compositor_upload_bitmap: (a: number, b: any, c: number, d: number) => [number, number];
  readonly compositor_upload_lut: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number];
  readonly compositor_upload_rgba: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => [number, number];
  readonly compositor_upload_video: (a: number, b: any, c: number, d: number) => void;
  readonly compositor_width: (a: number) => number;
  readonly __wbg_audioengine_free: (a: number, b: number) => void;
  readonly audioengine_clear_source_buffer: (a: number, b: number, c: number) => void;
  readonly audioengine_create_windowed_source: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => void;
  readonly audioengine_get_buffer_misses: (a: number, b: number, c: number) => bigint;
  readonly audioengine_get_current_time: (a: number) => number;
  readonly audioengine_new: (a: number) => number;
  readonly audioengine_remove_audio: (a: number, b: number, c: number) => void;
  readonly audioengine_render: (a: number, b: number, c: number, d: any, e: number) => number;
  readonly audioengine_seek: (a: number, b: number) => void;
  readonly audioengine_set_master_volume: (a: number, b: number) => void;
  readonly audioengine_set_playback_rate: (a: number, b: number) => void;
  readonly audioengine_set_playing: (a: number, b: number) => void;
  readonly audioengine_set_timeline: (a: number, b: number, c: number) => void;
  readonly audioengine_update_source_buffer: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
  readonly audioengine_update_source_sample_rate: (a: number, b: number, c: number, d: number) => void;
  readonly audioengine_upload_audio: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => void;
  readonly __wbg_demuxerhandle_free: (a: number, b: number) => void;
  readonly __wbg_sha256stream_free: (a: number, b: number) => void;
  readonly core_version: () => [number, number];
  readonly demuxerhandle_audio_description: (a: number) => [number, number];
  readonly demuxerhandle_audio_sample_count: (a: number) => number;
  readonly demuxerhandle_probe: (a: number, b: number) => [number, number, number];
  readonly demuxerhandle_read_audio_sample: (a: number, b: number) => [number, number, number];
  readonly demuxerhandle_video_description: (a: number) => [number, number];
  readonly normalize_transcript: (a: any, b: number, c: number) => [number, number, number];
  readonly open_demuxer: (a: any) => [number, number, number];
  readonly probe_and_validate: (a: number, b: number, c: number) => [number, number, number];
  readonly resample: (a: number, b: number, c: number, d: number) => [number, number];
  readonly sha256stream_finalize_hex: (a: number) => [number, number];
  readonly sha256stream_new: () => number;
  readonly sha256stream_update: (a: number, b: number, c: number) => void;
  readonly __wbg_keyframeevaluator_free: (a: number, b: number) => void;
  readonly evaluate_track: (a: any, b: number) => [number, number, number];
  readonly keyframeevaluator_clear_cache: (a: number) => void;
  readonly keyframeevaluator_evaluate: (a: number, b: number, c: number, d: number) => number;
  readonly keyframeevaluator_has_property: (a: number, b: number, c: number) => number;
  readonly keyframeevaluator_new: (a: any) => [number, number, number];
  readonly keyframeevaluator_properties: (a: number) => [number, number, number];
  readonly __wbg_color_free: (a: number, b: number) => void;
  readonly __wbg_get_color_a: (a: number) => number;
  readonly __wbg_get_color_b: (a: number) => number;
  readonly __wbg_get_color_g: (a: number) => number;
  readonly __wbg_get_color_r: (a: number) => number;
  readonly __wbg_set_color_a: (a: number, b: number) => void;
  readonly __wbg_set_color_b: (a: number, b: number) => void;
  readonly __wbg_set_color_g: (a: number, b: number) => void;
  readonly __wbg_set_color_r: (a: number, b: number) => void;
  readonly color_from_hex: (a: number, b: number) => number;
  readonly color_new: (a: number, b: number, c: number, d: number) => number;
  readonly color_rgb: (a: number, b: number, c: number) => number;
  readonly color_to_hex: (a: number) => [number, number];
  readonly cubicbezier_evaluate: (a: number, b: number) => number;
  readonly __wbg_get_cubicbezier_x1: (a: number) => number;
  readonly __wbg_get_cubicbezier_x2: (a: number) => number;
  readonly __wbg_get_cubicbezier_y1: (a: number) => number;
  readonly __wbg_get_cubicbezier_y2: (a: number) => number;
  readonly __wbg_set_cubicbezier_x1: (a: number, b: number) => void;
  readonly __wbg_set_cubicbezier_x2: (a: number, b: number) => void;
  readonly __wbg_set_cubicbezier_y1: (a: number, b: number) => void;
  readonly __wbg_set_cubicbezier_y2: (a: number, b: number) => void;
  readonly cubicbezier_new: (a: number, b: number, c: number, d: number) => number;
  readonly __wbg_cubicbezier_free: (a: number, b: number) => void;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
  readonly __wbindgen_exn_store: (a: number) => void;
  readonly __externref_table_alloc: () => number;
  readonly __wbindgen_export_4: WebAssembly.Table;
  readonly __wbindgen_free: (a: number, b: number, c: number) => void;
  readonly __wbindgen_export_6: WebAssembly.Table;
  readonly __externref_table_dealloc: (a: number) => void;
  readonly closure525_externref_shim: (a: number, b: number, c: any) => void;
  readonly closure2001_externref_shim: (a: number, b: number, c: any, d: any) => void;
  readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;
/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
*
* @returns {InitOutput}
*/
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
