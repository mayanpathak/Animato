let wasm;

let WASM_VECTOR_LEN = 0;

let cachedUint8ArrayMemory0 = null;

function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

const cachedTextEncoder = (typeof TextEncoder !== 'undefined' ? new TextEncoder('utf-8') : { encode: () => { throw Error('TextEncoder not available') } } );

const encodeString = (typeof cachedTextEncoder.encodeInto === 'function'
    ? function (arg, view) {
    return cachedTextEncoder.encodeInto(arg, view);
}
    : function (arg, view) {
    const buf = cachedTextEncoder.encode(arg);
    view.set(buf);
    return {
        read: arg.length,
        written: buf.length
    };
});

function passStringToWasm0(arg, malloc, realloc) {

    if (realloc === undefined) {
        const buf = cachedTextEncoder.encode(arg);
        const ptr = malloc(buf.length, 1) >>> 0;
        getUint8ArrayMemory0().subarray(ptr, ptr + buf.length).set(buf);
        WASM_VECTOR_LEN = buf.length;
        return ptr;
    }

    let len = arg.length;
    let ptr = malloc(len, 1) >>> 0;

    const mem = getUint8ArrayMemory0();

    let offset = 0;

    for (; offset < len; offset++) {
        const code = arg.charCodeAt(offset);
        if (code > 0x7F) break;
        mem[ptr + offset] = code;
    }

    if (offset !== len) {
        if (offset !== 0) {
            arg = arg.slice(offset);
        }
        ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
        const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
        const ret = encodeString(arg, view);

        offset += ret.written;
        ptr = realloc(ptr, len, offset, 1) >>> 0;
    }

    WASM_VECTOR_LEN = offset;
    return ptr;
}

let cachedDataViewMemory0 = null;

function getDataViewMemory0() {
    if (cachedDataViewMemory0 === null || cachedDataViewMemory0.buffer.detached === true || (cachedDataViewMemory0.buffer.detached === undefined && cachedDataViewMemory0.buffer !== wasm.memory.buffer)) {
        cachedDataViewMemory0 = new DataView(wasm.memory.buffer);
    }
    return cachedDataViewMemory0;
}

function addToExternrefTable0(obj) {
    const idx = wasm.__externref_table_alloc();
    wasm.__wbindgen_export_4.set(idx, obj);
    return idx;
}

function handleError(f, args) {
    try {
        return f.apply(this, args);
    } catch (e) {
        const idx = addToExternrefTable0(e);
        wasm.__wbindgen_exn_store(idx);
    }
}

function debugString(val) {
    // primitive types
    const type = typeof val;
    if (type == 'number' || type == 'boolean' || val == null) {
        return  `${val}`;
    }
    if (type == 'string') {
        return `"${val}"`;
    }
    if (type == 'symbol') {
        const description = val.description;
        if (description == null) {
            return 'Symbol';
        } else {
            return `Symbol(${description})`;
        }
    }
    if (type == 'function') {
        const name = val.name;
        if (typeof name == 'string' && name.length > 0) {
            return `Function(${name})`;
        } else {
            return 'Function';
        }
    }
    // objects
    if (Array.isArray(val)) {
        const length = val.length;
        let debug = '[';
        if (length > 0) {
            debug += debugString(val[0]);
        }
        for(let i = 1; i < length; i++) {
            debug += ', ' + debugString(val[i]);
        }
        debug += ']';
        return debug;
    }
    // Test for built-in
    const builtInMatches = /\[object ([^\]]+)\]/.exec(toString.call(val));
    let className;
    if (builtInMatches && builtInMatches.length > 1) {
        className = builtInMatches[1];
    } else {
        // Failed to match the standard '[object ClassName]'
        return toString.call(val);
    }
    if (className == 'Object') {
        // we're a user defined class or Object
        // JSON.stringify avoids problems with cycles, and is generally much
        // easier than looping through ownProperties of `val`.
        try {
            return 'Object(' + JSON.stringify(val) + ')';
        } catch (_) {
            return 'Object';
        }
    }
    // errors
    if (val instanceof Error) {
        return `${val.name}: ${val.message}\n${val.stack}`;
    }
    // TODO we could test for more things here, like `Set`s and `Map`s.
    return className;
}

const cachedTextDecoder = (typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-8', { ignoreBOM: true, fatal: true }) : { decode: () => { throw Error('TextDecoder not available') } } );

if (typeof TextDecoder !== 'undefined') { cachedTextDecoder.decode(); };

function getStringFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

function isLikeNone(x) {
    return x === undefined || x === null;
}
/**
 * Version string shown in the editor's performance badge.
 * @returns {string}
 */
export function engine_version() {
    let deferred1_0;
    let deferred1_1;
    try {
        const ret = wasm.engine_version();
        deferred1_0 = ret[0];
        deferred1_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
}

/**
 * `HH:MM:SS:FF` for a time in seconds at `fps`.
 * @param {number} seconds
 * @param {number} fps
 * @returns {string}
 */
export function seconds_to_timecode(seconds, fps) {
    let deferred1_0;
    let deferred1_1;
    try {
        const ret = wasm.seconds_to_timecode(seconds, fps);
        deferred1_0 = ret[0];
        deferred1_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
}

/**
 * Seconds for an `HH:MM:SS:FF` (or `MM:SS:FF`) timecode, or `NaN`.
 * @param {string} timecode
 * @param {number} fps
 * @returns {number}
 */
export function timecode_to_seconds(timecode, fps) {
    const ptr0 = passStringToWasm0(timecode, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.timecode_to_seconds(ptr0, len0, fps);
    return ret;
}

let cachedFloat64ArrayMemory0 = null;

function getFloat64ArrayMemory0() {
    if (cachedFloat64ArrayMemory0 === null || cachedFloat64ArrayMemory0.byteLength === 0) {
        cachedFloat64ArrayMemory0 = new Float64Array(wasm.memory.buffer);
    }
    return cachedFloat64ArrayMemory0;
}

function passArrayF64ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 8, 8) >>> 0;
    getFloat64ArrayMemory0().set(arg, ptr / 8);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}
/**
 * The target nearest to `time` if it lies within `threshold`, else `time`.
 * @param {number} time
 * @param {Float64Array} targets
 * @param {number} threshold
 * @returns {number}
 */
export function snap(time, targets, threshold) {
    const ptr0 = passArrayF64ToWasm0(targets, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.snap(time, ptr0, len0, threshold);
    return ret;
}

function takeFromExternrefTable0(idx) {
    const value = wasm.__wbindgen_export_4.get(idx);
    wasm.__externref_table_dealloc(idx);
    return value;
}
/**
 * Value of a keyframed property at `time`, evaluated by `tooscut-keyframe`.
 * Input: `[{time, value, ease}]` where `ease` is `linear`, `step`,
 * `easeIn`, `easeOut` or `easeInOut`.
 * @param {string} keys_json
 * @param {number} time
 * @returns {number}
 */
export function keyframe_value(keys_json, time) {
    const ptr0 = passStringToWasm0(keys_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.keyframe_value(ptr0, len0, time);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return ret[0];
}

/**
 * Splits the clip at timeline time `at`. The right half gets `new_id`.
 * Returns the timeline unchanged when `at` is not inside the clip.
 * @param {string} timeline
 * @param {string} clip_id
 * @param {number} at
 * @param {string} new_id
 * @returns {string}
 */
export function split_clip(timeline, clip_id, at, new_id) {
    let deferred5_0;
    let deferred5_1;
    try {
        const ptr0 = passStringToWasm0(timeline, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(clip_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passStringToWasm0(new_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len2 = WASM_VECTOR_LEN;
        const ret = wasm.split_clip(ptr0, len0, ptr1, len1, at, ptr2, len2);
        var ptr4 = ret[0];
        var len4 = ret[1];
        if (ret[3]) {
            ptr4 = 0; len4 = 0;
            throw takeFromExternrefTable0(ret[2]);
        }
        deferred5_0 = ptr4;
        deferred5_1 = len4;
        return getStringFromWasm0(ptr4, len4);
    } finally {
        wasm.__wbindgen_free(deferred5_0, deferred5_1, 1);
    }
}

/**
 * Moves one edge of a clip to timeline time `to`. `edge` is `"start"` or
 * `"end"`. Trimming the start also advances the clip's source offset.
 * @param {string} timeline
 * @param {string} clip_id
 * @param {string} edge
 * @param {number} to
 * @returns {string}
 */
export function trim_clip(timeline, clip_id, edge, to) {
    let deferred5_0;
    let deferred5_1;
    try {
        const ptr0 = passStringToWasm0(timeline, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(clip_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passStringToWasm0(edge, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len2 = WASM_VECTOR_LEN;
        const ret = wasm.trim_clip(ptr0, len0, ptr1, len1, ptr2, len2, to);
        var ptr4 = ret[0];
        var len4 = ret[1];
        if (ret[3]) {
            ptr4 = 0; len4 = 0;
            throw takeFromExternrefTable0(ret[2]);
        }
        deferred5_0 = ptr4;
        deferred5_1 = len4;
        return getStringFromWasm0(ptr4, len4);
    } finally {
        wasm.__wbindgen_free(deferred5_0, deferred5_1, 1);
    }
}

/**
 * Removes a clip and pulls every later clip on its track left to close the gap.
 * @param {string} timeline
 * @param {string} clip_id
 * @returns {string}
 */
export function ripple_delete(timeline, clip_id) {
    let deferred4_0;
    let deferred4_1;
    try {
        const ptr0 = passStringToWasm0(timeline, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(clip_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ret = wasm.ripple_delete(ptr0, len0, ptr1, len1);
        var ptr3 = ret[0];
        var len3 = ret[1];
        if (ret[3]) {
            ptr3 = 0; len3 = 0;
            throw takeFromExternrefTable0(ret[2]);
        }
        deferred4_0 = ptr3;
        deferred4_1 = len3;
        return getStringFromWasm0(ptr3, len3);
    } finally {
        wasm.__wbindgen_free(deferred4_0, deferred4_1, 1);
    }
}

/**
 * Cues from SubRip text, as JSON `[{start, end, text}]` in seconds.
 * Malformed blocks are skipped.
 * @param {string} text
 * @returns {string}
 */
export function parse_srt(text) {
    let deferred3_0;
    let deferred3_1;
    try {
        const ptr0 = passStringToWasm0(text, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.parse_srt(ptr0, len0);
        var ptr2 = ret[0];
        var len2 = ret[1];
        if (ret[3]) {
            ptr2 = 0; len2 = 0;
            throw takeFromExternrefTable0(ret[2]);
        }
        deferred3_0 = ptr2;
        deferred3_1 = len2;
        return getStringFromWasm0(ptr2, len2);
    } finally {
        wasm.__wbindgen_free(deferred3_0, deferred3_1, 1);
    }
}

/**
 * SubRip text for JSON cues `[{start, end, text}]`.
 * @param {string} cues_json
 * @returns {string}
 */
export function to_srt(cues_json) {
    let deferred3_0;
    let deferred3_1;
    try {
        const ptr0 = passStringToWasm0(cues_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.to_srt(ptr0, len0);
        var ptr2 = ret[0];
        var len2 = ret[1];
        if (ret[3]) {
            ptr2 = 0; len2 = 0;
            throw takeFromExternrefTable0(ret[2]);
        }
        deferred3_0 = ptr2;
        deferred3_1 = len2;
        return getStringFromWasm0(ptr2, len2);
    } finally {
        wasm.__wbindgen_free(deferred3_0, deferred3_1, 1);
    }
}

/**
 * Caption cues from timed words, one cue per sentence, using the transcript
 * normalizer from `offcut-text`. Input: `[{text, startMs, endMs, confidence}]`.
 * @param {string} words_json
 * @returns {string}
 */
export function captions_from_words(words_json) {
    let deferred3_0;
    let deferred3_1;
    try {
        const ptr0 = passStringToWasm0(words_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.captions_from_words(ptr0, len0);
        var ptr2 = ret[0];
        var len2 = ret[1];
        if (ret[3]) {
            ptr2 = 0; len2 = 0;
            throw takeFromExternrefTable0(ret[2]);
        }
        deferred3_0 = ptr2;
        deferred3_1 = len2;
        return getStringFromWasm0(ptr2, len2);
    } finally {
        wasm.__wbindgen_free(deferred3_0, deferred3_1, 1);
    }
}

let cachedFloat32ArrayMemory0 = null;

function getFloat32ArrayMemory0() {
    if (cachedFloat32ArrayMemory0 === null || cachedFloat32ArrayMemory0.byteLength === 0) {
        cachedFloat32ArrayMemory0 = new Float32Array(wasm.memory.buffer);
    }
    return cachedFloat32ArrayMemory0;
}

function passArrayF32ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 4, 4) >>> 0;
    getFloat32ArrayMemory0().set(arg, ptr / 4);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function getArrayF32FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getFloat32ArrayMemory0().subarray(ptr / 4, ptr / 4 + len);
}
/**
 * Peak absolute amplitude of `pcm` in `buckets` equal slices, each in 0..=1.
 * @param {Float32Array} pcm
 * @param {number} buckets
 * @returns {Float32Array}
 */
export function waveform_peaks(pcm, buckets) {
    const ptr0 = passArrayF32ToWasm0(pcm, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.waveform_peaks(ptr0, len0, buckets);
    var v2 = getArrayF32FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v2;
}

/**
 * Mono resampling with the FFT resampler from `offcut-dsp`.
 * @param {Float32Array} pcm
 * @param {number} from_hz
 * @param {number} to_hz
 * @returns {Float32Array}
 */
export function resample(pcm, from_hz, to_hz) {
    const ptr0 = passArrayF32ToWasm0(pcm, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.resample(ptr0, len0, from_hz, to_hz);
    var v2 = getArrayF32FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v2;
}

function getArrayU8FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint8ArrayMemory0().subarray(ptr / 1, ptr / 1 + len);
}

function passArray8ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 1, 1) >>> 0;
    getUint8ArrayMemory0().set(arg, ptr / 1);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}
/**
 * Evaluate a single keyframe track at the given time.
 *
 * This is a convenience function for one-off evaluations.
 * For repeated evaluations, use `KeyframeEvaluator` which caches
 * the last index for better performance.
 * @param {any} track
 * @param {number} time
 * @returns {number}
 */
export function evaluate_track(track, time) {
    const ret = wasm.evaluate_track(track, time);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return ret[0];
}

/**
 * Types of cross-transitions between clips.
 * @enum {0 | 1 | 2 | 3 | 4 | 5}
 */
export const CrossTransitionType = Object.freeze({
    Dissolve: 0, "0": "Dissolve",
    Fade: 1, "1": "Fade",
    WipeLeft: 2, "2": "WipeLeft",
    WipeRight: 3, "3": "WipeRight",
    WipeUp: 4, "4": "WipeUp",
    WipeDown: 5, "5": "WipeDown",
});
/**
 * Common easing presets.
 * @enum {0 | 1 | 2 | 3 | 4}
 */
export const EasingPreset = Object.freeze({
    Linear: 0, "0": "Linear",
    EaseIn: 1, "1": "EaseIn",
    EaseOut: 2, "2": "EaseOut",
    EaseInOut: 3, "3": "EaseInOut",
    Custom: 4, "4": "Custom",
});
/**
 * Animatable effect property names.
 *
 * Used for keyframe animation targeting.
 * @enum {0 | 1 | 2 | 3 | 4 | 5}
 */
export const EffectProperty = Object.freeze({
    Opacity: 0, "0": "Opacity",
    Brightness: 1, "1": "Brightness",
    Contrast: 2, "2": "Contrast",
    Saturation: 3, "3": "Saturation",
    HueRotate: 4, "4": "HueRotate",
    Blur: 5, "5": "Blur",
});
/**
 * Interpolation mode between keyframes.
 * @enum {0 | 1 | 2}
 */
export const Interpolation = Object.freeze({
    /**
     * Linear interpolation between values.
     */
    Linear: 0, "0": "Linear",
    /**
     * Hold previous value until next keyframe (step function).
     */
    Step: 1, "1": "Step",
    /**
     * Cubic bezier interpolation with custom easing.
     */
    Bezier: 2, "2": "Bezier",
});
/**
 * Line endpoint head types.
 * @enum {0 | 1 | 2 | 3 | 4}
 */
export const LineHeadType = Object.freeze({
    None: 0, "0": "None",
    Arrow: 1, "1": "Arrow",
    Circle: 2, "2": "Circle",
    Square: 3, "3": "Square",
    Diamond: 4, "4": "Diamond",
});
/**
 * Line stroke style.
 * @enum {0 | 1 | 2}
 */
export const LineStrokeStyle = Object.freeze({
    Solid: 0, "0": "Solid",
    Dashed: 1, "1": "Dashed",
    Dotted: 2, "2": "Dotted",
});
/**
 * Primitive shape types.
 *
 * - Rectangle: 4-sided shape with optional corner radius (square is equal width/height)
 * - Ellipse: Oval shape (circle is equal width/height)
 * - Polygon: N-sided regular polygon defined by number of sides
 * @enum {0 | 1 | 2}
 */
export const ShapeType = Object.freeze({
    Rectangle: 0, "0": "Rectangle",
    Ellipse: 1, "1": "Ellipse",
    Polygon: 2, "2": "Polygon",
});
/**
 * Text alignment.
 * @enum {0 | 1 | 2}
 */
export const TextAlign = Object.freeze({
    Left: 0, "0": "Left",
    Center: 1, "1": "Center",
    Right: 2, "2": "Right",
});
/**
 * Types of transitions available.
 * @enum {0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16}
 */
export const TransitionType = Object.freeze({
    None: 0, "0": "None",
    Fade: 1, "1": "Fade",
    Dissolve: 2, "2": "Dissolve",
    WipeLeft: 3, "3": "WipeLeft",
    WipeRight: 4, "4": "WipeRight",
    WipeUp: 5, "5": "WipeUp",
    WipeDown: 6, "6": "WipeDown",
    SlideLeft: 7, "7": "SlideLeft",
    SlideRight: 8, "8": "SlideRight",
    SlideUp: 9, "9": "SlideUp",
    SlideDown: 10, "10": "SlideDown",
    ZoomIn: 11, "11": "ZoomIn",
    ZoomOut: 12, "12": "ZoomOut",
    RotateCw: 13, "13": "RotateCw",
    RotateCcw: 14, "14": "RotateCcw",
    FlipH: 15, "15": "FlipH",
    FlipV: 16, "16": "FlipV",
});
/**
 * Vertical alignment for text within its box.
 * @enum {0 | 1 | 2}
 */
export const VerticalAlign = Object.freeze({
    Top: 0, "0": "Top",
    Middle: 1, "1": "Middle",
    Bottom: 2, "2": "Bottom",
});

const ColorFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_color_free(ptr >>> 0, 1));
/**
 * RGBA color with components in 0.0-1.0 range.
 */
export class Color {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(Color.prototype);
        obj.__wbg_ptr = ptr;
        ColorFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        ColorFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_color_free(ptr, 0);
    }
    /**
     * @returns {number}
     */
    get r() {
        const ret = wasm.__wbg_get_color_r(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {number} arg0
     */
    set r(arg0) {
        wasm.__wbg_set_color_r(this.__wbg_ptr, arg0);
    }
    /**
     * @returns {number}
     */
    get g() {
        const ret = wasm.__wbg_get_color_g(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {number} arg0
     */
    set g(arg0) {
        wasm.__wbg_set_color_g(this.__wbg_ptr, arg0);
    }
    /**
     * @returns {number}
     */
    get b() {
        const ret = wasm.__wbg_get_color_b(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {number} arg0
     */
    set b(arg0) {
        wasm.__wbg_set_color_b(this.__wbg_ptr, arg0);
    }
    /**
     * @returns {number}
     */
    get a() {
        const ret = wasm.__wbg_get_color_a(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {number} arg0
     */
    set a(arg0) {
        wasm.__wbg_set_color_a(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} r
     * @param {number} g
     * @param {number} b
     * @param {number} a
     */
    constructor(r, g, b, a) {
        const ret = wasm.color_new(r, g, b, a);
        this.__wbg_ptr = ret >>> 0;
        ColorFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * Create an opaque RGB color.
     * @param {number} r
     * @param {number} g
     * @param {number} b
     * @returns {Color}
     */
    static rgb(r, g, b) {
        const ret = wasm.color_rgb(r, g, b);
        return Color.__wrap(ret);
    }
    /**
     * Convert to hex string with alpha (e.g., "#ff0000ff").
     * @returns {string}
     */
    to_hex() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.color_to_hex(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * Parse from hex string (e.g., "#ff0000" or "#ff0000ff").
     * @param {string} hex
     * @returns {Color | undefined}
     */
    static from_hex(hex) {
        const ptr0 = passStringToWasm0(hex, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.color_from_hex(ptr0, len0);
        return ret === 0 ? undefined : Color.__wrap(ret);
    }
}

const CubicBezierFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_cubicbezier_free(ptr >>> 0, 1));
/**
 * Cubic bezier control points [x1, y1, x2, y2].
 * Controls the acceleration curve of animations and transitions.
 */
export class CubicBezier {

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        CubicBezierFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_cubicbezier_free(ptr, 0);
    }
    /**
     * @returns {number}
     */
    get x1() {
        const ret = wasm.__wbg_get_color_r(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {number} arg0
     */
    set x1(arg0) {
        wasm.__wbg_set_color_r(this.__wbg_ptr, arg0);
    }
    /**
     * @returns {number}
     */
    get y1() {
        const ret = wasm.__wbg_get_color_g(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {number} arg0
     */
    set y1(arg0) {
        wasm.__wbg_set_color_g(this.__wbg_ptr, arg0);
    }
    /**
     * @returns {number}
     */
    get x2() {
        const ret = wasm.__wbg_get_color_b(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {number} arg0
     */
    set x2(arg0) {
        wasm.__wbg_set_color_b(this.__wbg_ptr, arg0);
    }
    /**
     * @returns {number}
     */
    get y2() {
        const ret = wasm.__wbg_get_color_a(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {number} arg0
     */
    set y2(arg0) {
        wasm.__wbg_set_color_a(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} x1
     * @param {number} y1
     * @param {number} x2
     * @param {number} y2
     */
    constructor(x1, y1, x2, y2) {
        const ret = wasm.color_new(x1, y1, x2, y2);
        this.__wbg_ptr = ret >>> 0;
        CubicBezierFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * Evaluate the bezier curve at progress t (0.0-1.0).
     * Uses Newton-Raphson iteration to find the curve parameter.
     * @param {number} t
     * @returns {number}
     */
    evaluate(t) {
        const ret = wasm.cubicbezier_evaluate(this.__wbg_ptr, t);
        return ret;
    }
}

const GifWriterFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_gifwriter_free(ptr >>> 0, 1));
/**
 * Animated GIF encoder for the editor's local export. Frames are RGBA,
 * quantized per frame with NeuQuant (the `gif` crate). Runs in a worker.
 */
export class GifWriter {

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        GifWriterFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_gifwriter_free(ptr, 0);
    }
    /**
     * `delay_cs`: frame delay in hundredths of a second. `speed`: 1 (best)
     * to 30 (fastest) quantization.
     * @param {number} width
     * @param {number} height
     * @param {number} delay_cs
     * @param {number} speed
     */
    constructor(width, height, delay_cs, speed) {
        const ret = wasm.gifwriter_new(width, height, delay_cs, speed);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        this.__wbg_ptr = ret[0] >>> 0;
        GifWriterFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * The finished file. The writer cannot be used afterwards.
     * @returns {Uint8Array}
     */
    finish() {
        const ret = wasm.gifwriter_finish(this.__wbg_ptr);
        if (ret[3]) {
            throw takeFromExternrefTable0(ret[2]);
        }
        var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        return v1;
    }
    /**
     * Appends one RGBA frame of exactly `width * height * 4` bytes.
     * @param {Uint8Array} rgba
     */
    add_frame(rgba) {
        const ptr0 = passArray8ToWasm0(rgba, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.gifwriter_add_frame(this.__wbg_ptr, ptr0, len0);
        if (ret[1]) {
            throw takeFromExternrefTable0(ret[0]);
        }
    }
}

const KeyframeEvaluatorFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_keyframeevaluator_free(ptr >>> 0, 1));
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

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        KeyframeEvaluatorFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_keyframeevaluator_free(ptr, 0);
    }
    /**
     * Get all animated property names.
     * @returns {any}
     */
    properties() {
        const ret = wasm.keyframeevaluator_properties(this.__wbg_ptr);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * Clear the temporal cache (call after seeking).
     */
    clear_cache() {
        wasm.keyframeevaluator_clear_cache(this.__wbg_ptr);
    }
    /**
     * Check if a property exists and has keyframes.
     * @param {string} property
     * @returns {boolean}
     */
    has_property(property) {
        const ptr0 = passStringToWasm0(property, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.keyframeevaluator_has_property(this.__wbg_ptr, ptr0, len0);
        return ret !== 0;
    }
    /**
     * Create a new evaluator from a KeyframeTracks object.
     * @param {any} tracks
     */
    constructor(tracks) {
        const ret = wasm.keyframeevaluator_new(tracks);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        this.__wbg_ptr = ret[0] >>> 0;
        KeyframeEvaluatorFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * Evaluate a property at the given time.
     *
     * Returns `None` (as NaN) if the property doesn't exist.
     * @param {string} property
     * @param {number} time
     * @returns {number}
     */
    evaluate(property, time) {
        const ptr0 = passStringToWasm0(property, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.keyframeevaluator_evaluate(this.__wbg_ptr, ptr0, len0, time);
        return ret;
    }
}

async function __wbg_load(module, imports) {
    if (typeof Response === 'function' && module instanceof Response) {
        if (typeof WebAssembly.instantiateStreaming === 'function') {
            try {
                return await WebAssembly.instantiateStreaming(module, imports);

            } catch (e) {
                if (module.headers.get('Content-Type') != 'application/wasm') {
                    console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);

                } else {
                    throw e;
                }
            }
        }

        const bytes = await module.arrayBuffer();
        return await WebAssembly.instantiate(bytes, imports);

    } else {
        const instance = await WebAssembly.instantiate(module, imports);

        if (instance instanceof WebAssembly.Instance) {
            return { instance, module };

        } else {
            return instance;
        }
    }
}

function __wbg_get_imports() {
    const imports = {};
    imports.wbg = {};
    imports.wbg.__wbg_String_8f0eb39a4a4c2f66 = function(arg0, arg1) {
        const ret = String(arg1);
        const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
        getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
    };
    imports.wbg.__wbg_buffer_609cc3eee51ed158 = function(arg0) {
        const ret = arg0.buffer;
        return ret;
    };
    imports.wbg.__wbg_call_672a4d21634d4a24 = function() { return handleError(function (arg0, arg1) {
        const ret = arg0.call(arg1);
        return ret;
    }, arguments) };
    imports.wbg.__wbg_done_769e5ede4b31c67b = function(arg0) {
        const ret = arg0.done;
        return ret;
    };
    imports.wbg.__wbg_entries_3265d4158b33e5dc = function(arg0) {
        const ret = Object.entries(arg0);
        return ret;
    };
    imports.wbg.__wbg_get_67b2ba62fc30de12 = function() { return handleError(function (arg0, arg1) {
        const ret = Reflect.get(arg0, arg1);
        return ret;
    }, arguments) };
    imports.wbg.__wbg_get_b9b93047fe3cf45b = function(arg0, arg1) {
        const ret = arg0[arg1 >>> 0];
        return ret;
    };
    imports.wbg.__wbg_getwithrefkey_1dc361bd10053bfe = function(arg0, arg1) {
        const ret = arg0[arg1];
        return ret;
    };
    imports.wbg.__wbg_instanceof_ArrayBuffer_e14585432e3737fc = function(arg0) {
        let result;
        try {
            result = arg0 instanceof ArrayBuffer;
        } catch (_) {
            result = false;
        }
        const ret = result;
        return ret;
    };
    imports.wbg.__wbg_instanceof_Uint8Array_17156bcf118086a9 = function(arg0) {
        let result;
        try {
            result = arg0 instanceof Uint8Array;
        } catch (_) {
            result = false;
        }
        const ret = result;
        return ret;
    };
    imports.wbg.__wbg_isArray_a1eab7e0d067391b = function(arg0) {
        const ret = Array.isArray(arg0);
        return ret;
    };
    imports.wbg.__wbg_iterator_9a24c88df860dc65 = function() {
        const ret = Symbol.iterator;
        return ret;
    };
    imports.wbg.__wbg_length_a446193dc22c12f8 = function(arg0) {
        const ret = arg0.length;
        return ret;
    };
    imports.wbg.__wbg_length_e2d2a49132c1b256 = function(arg0) {
        const ret = arg0.length;
        return ret;
    };
    imports.wbg.__wbg_new_78feb108b6472713 = function() {
        const ret = new Array();
        return ret;
    };
    imports.wbg.__wbg_new_a12002a7f91c75be = function(arg0) {
        const ret = new Uint8Array(arg0);
        return ret;
    };
    imports.wbg.__wbg_next_25feadfc0913fea9 = function(arg0) {
        const ret = arg0.next;
        return ret;
    };
    imports.wbg.__wbg_next_6574e1a8a62d1055 = function() { return handleError(function (arg0) {
        const ret = arg0.next();
        return ret;
    }, arguments) };
    imports.wbg.__wbg_set_37837023f3d740e8 = function(arg0, arg1, arg2) {
        arg0[arg1 >>> 0] = arg2;
    };
    imports.wbg.__wbg_set_65595bdd868b3009 = function(arg0, arg1, arg2) {
        arg0.set(arg1, arg2 >>> 0);
    };
    imports.wbg.__wbg_value_cd1ffa7b1ab794f1 = function(arg0) {
        const ret = arg0.value;
        return ret;
    };
    imports.wbg.__wbindgen_boolean_get = function(arg0) {
        const v = arg0;
        const ret = typeof(v) === 'boolean' ? (v ? 1 : 0) : 2;
        return ret;
    };
    imports.wbg.__wbindgen_debug_string = function(arg0, arg1) {
        const ret = debugString(arg1);
        const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
        getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
    };
    imports.wbg.__wbindgen_error_new = function(arg0, arg1) {
        const ret = new Error(getStringFromWasm0(arg0, arg1));
        return ret;
    };
    imports.wbg.__wbindgen_in = function(arg0, arg1) {
        const ret = arg0 in arg1;
        return ret;
    };
    imports.wbg.__wbindgen_init_externref_table = function() {
        const table = wasm.__wbindgen_export_4;
        const offset = table.grow(4);
        table.set(0, undefined);
        table.set(offset + 0, undefined);
        table.set(offset + 1, null);
        table.set(offset + 2, true);
        table.set(offset + 3, false);
        ;
    };
    imports.wbg.__wbindgen_is_function = function(arg0) {
        const ret = typeof(arg0) === 'function';
        return ret;
    };
    imports.wbg.__wbindgen_is_object = function(arg0) {
        const val = arg0;
        const ret = typeof(val) === 'object' && val !== null;
        return ret;
    };
    imports.wbg.__wbindgen_is_string = function(arg0) {
        const ret = typeof(arg0) === 'string';
        return ret;
    };
    imports.wbg.__wbindgen_is_undefined = function(arg0) {
        const ret = arg0 === undefined;
        return ret;
    };
    imports.wbg.__wbindgen_jsval_loose_eq = function(arg0, arg1) {
        const ret = arg0 == arg1;
        return ret;
    };
    imports.wbg.__wbindgen_memory = function() {
        const ret = wasm.memory;
        return ret;
    };
    imports.wbg.__wbindgen_number_get = function(arg0, arg1) {
        const obj = arg1;
        const ret = typeof(obj) === 'number' ? obj : undefined;
        getDataViewMemory0().setFloat64(arg0 + 8 * 1, isLikeNone(ret) ? 0 : ret, true);
        getDataViewMemory0().setInt32(arg0 + 4 * 0, !isLikeNone(ret), true);
    };
    imports.wbg.__wbindgen_string_get = function(arg0, arg1) {
        const obj = arg1;
        const ret = typeof(obj) === 'string' ? obj : undefined;
        var ptr1 = isLikeNone(ret) ? 0 : passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        var len1 = WASM_VECTOR_LEN;
        getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
        getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
    };
    imports.wbg.__wbindgen_string_new = function(arg0, arg1) {
        const ret = getStringFromWasm0(arg0, arg1);
        return ret;
    };
    imports.wbg.__wbindgen_throw = function(arg0, arg1) {
        throw new Error(getStringFromWasm0(arg0, arg1));
    };

    return imports;
}

function __wbg_init_memory(imports, memory) {

}

function __wbg_finalize_init(instance, module) {
    wasm = instance.exports;
    __wbg_init.__wbindgen_wasm_module = module;
    cachedDataViewMemory0 = null;
    cachedFloat32ArrayMemory0 = null;
    cachedFloat64ArrayMemory0 = null;
    cachedUint8ArrayMemory0 = null;


    wasm.__wbindgen_start();
    return wasm;
}

function initSync(module) {
    if (wasm !== undefined) return wasm;


    if (typeof module !== 'undefined') {
        if (Object.getPrototypeOf(module) === Object.prototype) {
            ({module} = module)
        } else {
            console.warn('using deprecated parameters for `initSync()`; pass a single object instead')
        }
    }

    const imports = __wbg_get_imports();

    __wbg_init_memory(imports);

    if (!(module instanceof WebAssembly.Module)) {
        module = new WebAssembly.Module(module);
    }

    const instance = new WebAssembly.Instance(module, imports);

    return __wbg_finalize_init(instance, module);
}

async function __wbg_init(module_or_path) {
    if (wasm !== undefined) return wasm;


    if (typeof module_or_path !== 'undefined') {
        if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
            ({module_or_path} = module_or_path)
        } else {
            console.warn('using deprecated parameters for the initialization function; pass a single object instead')
        }
    }

    if (typeof module_or_path === 'undefined') {
        module_or_path = new URL('animato_wasm_bg.wasm', import.meta.url);
    }
    const imports = __wbg_get_imports();

    if (typeof module_or_path === 'string' || (typeof Request === 'function' && module_or_path instanceof Request) || (typeof URL === 'function' && module_or_path instanceof URL)) {
        module_or_path = fetch(module_or_path);
    }

    __wbg_init_memory(imports);

    const { instance, module } = await __wbg_load(await module_or_path, imports);

    return __wbg_finalize_init(instance, module);
}

export { initSync };
export default __wbg_init;
