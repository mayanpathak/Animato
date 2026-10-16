//! Each kind of graphic item: laid out once (`prepare`), drawn at a time
//! (`Prepared::draw`). Everything here is in design pixels.

use crate::SceneError;
use crate::captions::{self, Captions};
use crate::display_list::{Cap, DrawCmd, FontId, Join, Paint, PathEl, Point, Rect, Rgba, Stroke};
use crate::doc::{
    self, Align, Case, Corner, EasingId, Fit, GraphicItem, ImageRef, Layer, MotionKind, Seconds,
    ShadowSpec, ShapeKind, StrokeSpec, TextStyle, Transcript,
};
use crate::easing::ease;
use crate::fonts;
use crate::text::{self, Block, Motion, Placement};

pub(crate) struct Context<'a> {
    /// The canvas in design pixels.
    pub canvas: (f32, f32),
    pub safe: Rect,
    pub duration: Seconds,
    pub images: &'a [ImageRef],
    pub transcript: Option<&'a Transcript>,
}

impl Context<'_> {
    /// A box of the document in design pixels.
    fn rect(&self, b: &doc::Box) -> Rect {
        let (w, h) = self.canvas;
        Rect {
            x: b.x * w,
            y: b.y * h,
            w: b.w * w,
            h: b.h * h,
        }
    }
}

#[derive(Clone, Debug, PartialEq)]
pub(crate) enum Prepared {
    Title(Title),
    Captions(Captions),
    Shape(Shape),
    Image(Image),
    Progress {
        rect: Rect,
        color: Rgba,
        track: Rgba,
        duration: Seconds,
    },
    EndCard(EndCard),
    Watermark(Label),
}

#[derive(Clone, Debug, PartialEq)]
pub(crate) struct Title {
    start: Seconds,
    end: Seconds,
    block: Block,
    at: Placement,
    color: Rgba,
    stroke: Option<Stroke>,
    background: Option<Rgba>,
    size: f32,
    enter: doc::Motion,
    exit: doc::Motion,
}

#[derive(Clone, Debug, PartialEq)]
pub(crate) struct Shape {
    start: Seconds,
    end: Seconds,
    kind: ShapeKind,
    rect: Rect,
    radius: f32,
    fill: Paint,
    stroke: Option<StrokeSpec>,
    shadow: Option<ShadowSpec>,
    enter: doc::Motion,
    exit: doc::Motion,
}

#[derive(Clone, Debug, PartialEq)]
pub(crate) struct Image {
    start: Seconds,
    end: Seconds,
    image_id: String,
    /// The image, fitted.
    rect: Rect,
    /// The box, when `cover` makes the image overflow it.
    clip: Option<Rect>,
    opacity: f32,
}

/// One line of text on a pill (the watermark).
#[derive(Clone, Debug, PartialEq)]
pub(crate) struct Label {
    block: Block,
    at: Placement,
    color: Rgba,
    pill: Rect,
    pill_color: Rgba,
}

#[derive(Clone, Debug, PartialEq)]
pub(crate) struct EndCard {
    from: Seconds,
    fade: Seconds,
    background: Paint,
    canvas: Rect,
    headline: (Block, Placement),
    sub: (Block, Placement),
    color: Rgba,
    logo: Option<(String, Rect)>,
}

/// The face registered for `family`, else Inter, else the first face.
pub(crate) fn font(family: &str, weight: u16) -> Result<FontId, SceneError> {
    let family = if family.eq_ignore_ascii_case("serif") {
        "DejaVu Serif"
    } else {
        family
    };
    let face = fonts::find(family)
        .or_else(|| fonts::find("Inter"))
        .or_else(|| fonts::family(0).map(|_| 0));
    face.map(|face| FontId {
        face,
        weight: weight.clamp(1, 1000),
    })
    .ok_or(SceneError::Font)
}

fn finite(t: Seconds) -> bool {
    t.is_finite()
}

pub(crate) fn prepare(
    item: &GraphicItem,
    ctx: &Context<'_>,
) -> Result<Option<(Layer, Prepared)>, SceneError> {
    Ok(Some(match item {
        GraphicItem::Title {
            start,
            end,
            text: content,
            style,
            area,
            enter,
            exit,
            layer,
            ..
        } => {
            if !(finite(*start) && finite(*end)) || end <= start || content.trim().is_empty() {
                return Ok(None);
            }
            (
                *layer,
                Prepared::Title(title(
                    content,
                    style,
                    ctx.rect(area).clamped(ctx.safe),
                    *start,
                    *end,
                    *enter,
                    *exit,
                )?),
            )
        }
        GraphicItem::Captions {
            style,
            area,
            max_words,
            max_lines,
            highlight,
            layer,
            ..
        } => {
            let Some(transcript) = ctx.transcript else {
                return Ok(None);
            };
            let font = font(&style.font, style.weight)?;
            let area = ctx.rect(area).clamped(ctx.safe);
            (
                *layer,
                Prepared::Captions(captions::build(
                    transcript, style, font, area, *max_words, *max_lines, *highlight,
                )?),
            )
        }
        GraphicItem::Shape {
            start,
            end,
            shape,
            area,
            radius,
            fill,
            stroke,
            shadow,
            enter,
            exit,
            layer,
            ..
        } => {
            if !(finite(*start) && finite(*end)) || end <= start {
                return Ok(None);
            }
            let rect = ctx.rect(area);
            (
                *layer,
                Prepared::Shape(Shape {
                    start: *start,
                    end: *end,
                    kind: *shape,
                    rect,
                    radius: radius.max(0.0).min(rect.w.min(rect.h) / 2.0),
                    fill: paint_in(fill, rect),
                    stroke: *stroke,
                    shadow: *shadow,
                    enter: *enter,
                    exit: *exit,
                }),
            )
        }
        GraphicItem::Image {
            start,
            end,
            image_id,
            area,
            fit,
            opacity,
            layer,
            ..
        } => {
            let Some(image) = ctx.images.iter().find(|i| i.id == *image_id) else {
                return Ok(None);
            };
            if !(finite(*start) && finite(*end)) || end <= start {
                return Ok(None);
            }
            let area = ctx.rect(area);
            let rect = fitted(image, area, *fit);
            let clip = (*fit == Fit::Cover).then_some(area);
            (
                *layer,
                Prepared::Image(Image {
                    start: *start,
                    end: *end,
                    image_id: image_id.clone(),
                    rect,
                    clip,
                    opacity: opacity.clamp(0.0, 1.0),
                }),
            )
        }
        GraphicItem::Progress {
            area,
            color,
            track,
            layer,
            ..
        } => (
            *layer,
            Prepared::Progress {
                rect: ctx.rect(area),
                color: *color,
                track: *track,
                duration: ctx.duration,
            },
        ),
        GraphicItem::EndCard {
            duration,
            headline,
            sub,
            logo,
            background,
            font: family,
            color,
            layer,
            ..
        } => {
            if !(duration.is_finite() && *duration > 0.0) {
                return Ok(None);
            }
            (
                *layer,
                Prepared::EndCard(end_card(
                    ctx, *duration, headline, sub, *logo, background, family, *color,
                )?),
            )
        }
        GraphicItem::Watermark {
            corner,
            text: content,
            layer,
            ..
        } => {
            if content.trim().is_empty() {
                return Ok(None);
            }
            (
                *layer,
                Prepared::Watermark(watermark(ctx, *corner, content)?),
            )
        }
    }))
}

fn title(
    content: &str,
    style: &TextStyle,
    area: Rect,
    start: Seconds,
    end: Seconds,
    enter: doc::Motion,
    exit: doc::Motion,
) -> Result<Title, SceneError> {
    let font = font(&style.font, style.weight)?;
    let size = style.size.clamp(4.0, 600.0);
    let pad = if style.background.is_some() {
        size * 0.3
    } else {
        0.0
    };
    let inner = Rect {
        x: area.x + pad,
        y: area.y + pad,
        w: (area.w - pad * 2.0).max(1.0),
        h: (area.h - pad * 2.0).max(1.0),
    };
    let block = text::set(
        &text::paragraphs(content, style.case == Case::Upper),
        font,
        size,
        style.line_height.clamp(0.8, 3.0),
        inner.w - style.stroke.map_or(0.0, |s| s.width),
    )?;
    let at = text::place(&block, inner, style.align);
    Ok(Title {
        start,
        end,
        block,
        at,
        color: style.color,
        stroke: style.stroke.map(|s| Stroke {
            width: s.width,
            color: s.color,
        }),
        background: style.background,
        size,
        enter,
        exit,
    })
}

/// A gradient given in fractions of `rect`, in design pixels.
fn paint_in(paint: &Paint, rect: Rect) -> Paint {
    let at = |p: Point| Point {
        x: rect.x + p.x * rect.w,
        y: rect.y + p.y * rect.h,
    };
    match paint {
        Paint::Solid(c) => Paint::Solid(*c),
        Paint::Linear { from, to, stops } => Paint::Linear {
            from: at(*from),
            to: at(*to),
            stops: stops.clone(),
        },
        Paint::Radial {
            center,
            radius,
            stops,
        } => Paint::Radial {
            center: at(*center),
            radius: radius * rect.w.max(rect.h),
            stops: stops.clone(),
        },
    }
}

fn fitted(image: &ImageRef, area: Rect, fit: Fit) -> Rect {
    let (iw, ih) = (image.width.max(1) as f32, image.height.max(1) as f32);
    let k = match fit {
        Fit::Contain => (area.w / iw).min(area.h / ih),
        Fit::Cover => (area.w / iw).max(area.h / ih),
    };
    let (w, h) = (iw * k, ih * k);
    Rect {
        x: area.x + (area.w - w) / 2.0,
        y: area.y + (area.h - h) / 2.0,
        w,
        h,
    }
}

#[allow(clippy::too_many_arguments)]
fn end_card(
    ctx: &Context<'_>,
    duration: Seconds,
    headline: &str,
    sub: &str,
    logo: bool,
    background: &Paint,
    family: &str,
    color: Rgba,
) -> Result<EndCard, SceneError> {
    let (cw, ch) = ctx.canvas;
    let safe = ctx.safe;
    let band = |y0: f32, y1: f32| Rect {
        x: safe.x,
        y: ch * y0,
        w: safe.w,
        h: ch * (y1 - y0),
    };
    let head_font = font(family, 800)?;
    let head = text::set(
        &text::paragraphs(headline, false),
        head_font,
        92.0,
        1.1,
        safe.w,
    )?;
    let head_at = text::place(&head, band(0.38, 0.52), Align::Center);
    let sub_font = font(family, 500)?;
    let sub_block = text::set(&text::paragraphs(sub, false), sub_font, 44.0, 1.2, safe.w)?;
    let sub_at = text::place(&sub_block, band(0.53, 0.62), Align::Center);
    let logo = if logo {
        ctx.images
            .first()
            .map(|i| (i.id.clone(), fitted(i, band(0.22, 0.35), Fit::Contain)))
    } else {
        None
    };
    let canvas = Rect {
        x: 0.0,
        y: 0.0,
        w: cw,
        h: ch,
    };
    Ok(EndCard {
        from: (ctx.duration - duration).max(0.0),
        fade: (duration / 3.0).min(0.4),
        background: paint_in(background, canvas),
        canvas,
        headline: (head, head_at),
        sub: (sub_block, sub_at),
        color,
        logo,
    })
}

fn watermark(ctx: &Context<'_>, corner: Corner, content: &str) -> Result<Label, SceneError> {
    let font = font("Inter", 600)?;
    let block = text::set(
        &[content.split_whitespace().map(str::to_owned).collect()],
        font,
        28.0,
        1.2,
        f32::MAX,
    )?;
    let pad = 12.0;
    let (w, h) = (block.width() + pad * 2.0, block.height() + pad * 2.0);
    let s = ctx.safe;
    let (x, y) = match corner {
        Corner::BottomRight => (s.right() - w, s.bottom() - h),
        Corner::BottomLeft => (s.x, s.bottom() - h),
        Corner::TopRight => (s.right() - w, s.y),
        Corner::TopLeft => (s.x, s.y),
    };
    let pill = Rect { x, y, w, h };
    let at = text::place(
        &block,
        Rect {
            x: x + pad,
            y: y + pad,
            w: w - pad * 2.0,
            h: h - pad * 2.0,
        },
        Align::Center,
    );
    Ok(Label {
        block,
        at,
        color: Rgba {
            r: 255,
            g: 255,
            b: 255,
            a: 235,
        },
        pill,
        pill_color: Rgba {
            r: 0,
            g: 0,
            b: 0,
            a: 107,
        },
    })
}

/// How an item looks at `t` between its enter and exit motions: opacity, a
/// move/scale, and how much of a typewriter text is shown. `None` when it is
/// not shown.
fn envelope(
    enter: &doc::Motion,
    exit: &doc::Motion,
    start: Seconds,
    end: Seconds,
    t: Seconds,
    center: (f32, f32),
    size: f32,
) -> Option<(f32, Motion, f32)> {
    if t < start || t >= end {
        return None;
    }
    let (mut opacity, mut m, mut dy, mut reveal) = (1.0f32, 1.0f32, 0.0f32, 1.0f32);
    for (motion, passed, entering) in [(enter, t - start, true), (exit, end - t, false)] {
        if motion.kind == MotionKind::None || motion.duration.is_nan() || motion.duration <= 0.0 {
            continue;
        }
        let p = (passed / motion.duration) as f32;
        if p >= 1.0 {
            continue;
        }
        let e = ease(motion.easing, p);
        match motion.kind {
            MotionKind::None => {}
            MotionKind::Fade => opacity *= e,
            MotionKind::Rise => {
                opacity *= ease(EasingId::EaseOut, p);
                dy += (1.0 - e) * size * 0.6;
            }
            MotionKind::Pop => {
                opacity *= (p * 3.0).min(1.0);
                m *= 0.8 + 0.2 * e;
            }
            MotionKind::Typewriter if entering => reveal = reveal.min(ease(EasingId::Linear, p)),
            MotionKind::Typewriter => opacity *= e,
        }
    }
    if opacity <= 0.001 {
        return None;
    }
    Some((opacity.clamp(0.0, 1.0), Motion { m, center, dy }, reveal))
}

fn with_opacity(opacity: f32, out: &mut Vec<DrawCmd>, draw: impl FnOnce(&mut Vec<DrawCmd>)) {
    if opacity >= 0.999 {
        draw(out);
    } else {
        out.push(DrawCmd::PushLayer {
            opacity,
            clip: None,
        });
        draw(out);
        out.push(DrawCmd::PopLayer);
    }
}

fn center(r: Rect) -> (f32, f32) {
    (r.x + r.w / 2.0, r.y + r.h / 2.0)
}

/// A rounded rectangle as a path (corners as cubic arcs).
pub(crate) fn round_rect_path(r: Rect, radius: f32) -> Vec<PathEl> {
    let k = 0.552_284_8 * radius;
    let (x0, y0, x1, y1) = (r.x, r.y, r.right(), r.bottom());
    if radius <= 0.0 {
        return vec![
            PathEl::MoveTo(x0, y0),
            PathEl::LineTo(x1, y0),
            PathEl::LineTo(x1, y1),
            PathEl::LineTo(x0, y1),
            PathEl::Close,
        ];
    }
    vec![
        PathEl::MoveTo(x0 + radius, y0),
        PathEl::LineTo(x1 - radius, y0),
        PathEl::CurveTo(x1 - radius + k, y0, x1, y0 + radius - k, x1, y0 + radius),
        PathEl::LineTo(x1, y1 - radius),
        PathEl::CurveTo(x1, y1 - radius + k, x1 - radius + k, y1, x1 - radius, y1),
        PathEl::LineTo(x0 + radius, y1),
        PathEl::CurveTo(x0 + radius - k, y1, x0, y1 - radius + k, x0, y1 - radius),
        PathEl::LineTo(x0, y0 + radius),
        PathEl::CurveTo(x0, y0 + radius - k, x0 + radius - k, y0, x0 + radius, y0),
        PathEl::Close,
    ]
}

pub(crate) fn ellipse_path(r: Rect) -> Vec<PathEl> {
    let (cx, cy) = center(r);
    let (rx, ry) = (r.w / 2.0, r.h / 2.0);
    let (kx, ky) = (0.552_284_8 * rx, 0.552_284_8 * ry);
    vec![
        PathEl::MoveTo(cx + rx, cy),
        PathEl::CurveTo(cx + rx, cy + ky, cx + kx, cy + ry, cx, cy + ry),
        PathEl::CurveTo(cx - kx, cy + ry, cx - rx, cy + ky, cx - rx, cy),
        PathEl::CurveTo(cx - rx, cy - ky, cx - kx, cy - ry, cx, cy - ry),
        PathEl::CurveTo(cx + kx, cy - ry, cx + rx, cy - ky, cx + rx, cy),
        PathEl::Close,
    ]
}

impl Prepared {
    pub fn draw(&self, t: Seconds, out: &mut Vec<DrawCmd>) {
        match self {
            Prepared::Title(title) => title.draw(t, out),
            Prepared::Captions(captions) => captions.draw(t, out),
            Prepared::Shape(shape) => shape.draw(t, out),
            Prepared::Image(image) => {
                if t < image.start || t >= image.end || image.opacity <= 0.0 {
                    return;
                }
                let cmd = DrawCmd::Image {
                    image_id: image.image_id.clone(),
                    rect: image.rect,
                    opacity: image.opacity,
                };
                match image.clip {
                    Some(clip) => {
                        out.push(DrawCmd::PushLayer {
                            opacity: 1.0,
                            clip: Some(clip),
                        });
                        out.push(cmd);
                        out.push(DrawCmd::PopLayer);
                    }
                    None => out.push(cmd),
                }
            }
            Prepared::Progress {
                rect,
                color,
                track,
                duration,
            } => {
                let share = if *duration > 0.0 {
                    (t / duration).clamp(0.0, 1.0) as f32
                } else {
                    0.0
                };
                let radius = rect.h / 2.0;
                out.push(DrawCmd::FillRect {
                    rect: *rect,
                    radius,
                    paint: Paint::Solid(*track),
                });
                if share > 0.0 {
                    out.push(DrawCmd::FillRect {
                        rect: Rect {
                            w: rect.w * share,
                            ..*rect
                        },
                        radius: radius.min(rect.w * share / 2.0),
                        paint: Paint::Solid(*color),
                    });
                }
            }
            Prepared::EndCard(card) => card.draw(t, out),
            Prepared::Watermark(label) => {
                out.push(DrawCmd::FillRect {
                    rect: label.pill,
                    radius: label.pill.h / 2.0,
                    paint: Paint::Solid(label.pill_color),
                });
                text::draw(
                    &label.block,
                    &label.at,
                    &Motion::NONE,
                    usize::MAX,
                    None,
                    |_| label.color,
                    out,
                );
            }
        }
    }
}

impl Title {
    fn draw(&self, t: Seconds, out: &mut Vec<DrawCmd>) {
        let pad = if self.background.is_some() {
            self.size * 0.3 * self.at.scale
        } else {
            0.0
        };
        let rect = self.at.block_rect(&self.block, pad);
        let Some((opacity, motion, reveal)) = envelope(
            &self.enter,
            &self.exit,
            self.start,
            self.end,
            t,
            center(rect),
            self.size,
        ) else {
            return;
        };
        let words = self.block.word_count();
        let shown = ((words as f32) * reveal).ceil() as usize;
        with_opacity(opacity, out, |out| {
            if let Some(bg) = self.background {
                let r = motion.rect(rect);
                out.push(DrawCmd::FillRect {
                    rect: r,
                    radius: self.size * 0.25 * self.at.scale * motion.m,
                    paint: Paint::Solid(bg),
                });
            }
            text::draw(
                &self.block,
                &self.at,
                &motion,
                shown,
                self.stroke,
                |_| self.color,
                out,
            );
        });
    }
}

impl Shape {
    fn draw(&self, t: Seconds, out: &mut Vec<DrawCmd>) {
        let size = self.rect.h.min(self.rect.w);
        let Some((opacity, motion, _)) = envelope(
            &self.enter,
            &self.exit,
            self.start,
            self.end,
            t,
            center(self.rect),
            size * 0.3,
        ) else {
            return;
        };
        let rect = motion.rect(self.rect);
        let radius = match self.kind {
            ShapeKind::Rect => 0.0,
            ShapeKind::RoundRect | ShapeKind::Ellipse => self.radius * motion.m,
        };
        with_opacity(opacity, out, |out| {
            if let Some(shadow) = self.shadow {
                out.push(DrawCmd::BlurredRoundedRect {
                    rect: Rect {
                        y: rect.y + shadow.offset_y,
                        ..rect
                    },
                    radius: if self.kind == ShapeKind::Ellipse {
                        rect.w.min(rect.h) / 2.0
                    } else {
                        radius
                    },
                    std_dev: shadow.blur.max(0.0),
                    color: shadow.color,
                });
            }
            let paint = moved(&self.fill, &motion);
            let path = match self.kind {
                ShapeKind::Ellipse => ellipse_path(rect),
                _ => round_rect_path(rect, radius),
            };
            match self.kind {
                ShapeKind::Ellipse => out.push(DrawCmd::FillPath {
                    path: path.clone(),
                    paint,
                }),
                _ => out.push(DrawCmd::FillRect {
                    rect,
                    radius,
                    paint,
                }),
            }
            if let Some(stroke) = self.stroke.filter(|s| s.width > 0.0) {
                out.push(DrawCmd::StrokePath {
                    path,
                    width: stroke.width,
                    paint: Paint::Solid(stroke.color),
                    join: Join::Round,
                    cap: Cap::Round,
                });
            }
        });
    }
}

/// A paint's points moved with the shape.
fn moved(paint: &Paint, motion: &Motion) -> Paint {
    let at = |p: Point| {
        let (x, y) = motion.point(p.x, p.y);
        Point { x, y }
    };
    match paint {
        Paint::Solid(c) => Paint::Solid(*c),
        Paint::Linear { from, to, stops } => Paint::Linear {
            from: at(*from),
            to: at(*to),
            stops: stops.clone(),
        },
        Paint::Radial {
            center,
            radius,
            stops,
        } => Paint::Radial {
            center: at(*center),
            radius: radius * motion.m,
            stops: stops.clone(),
        },
    }
}

impl EndCard {
    fn draw(&self, t: Seconds, out: &mut Vec<DrawCmd>) {
        if t < self.from {
            return;
        }
        let opacity = if self.fade > 0.0 {
            (((t - self.from) / self.fade) as f32).clamp(0.0, 1.0)
        } else {
            1.0
        };
        if opacity <= 0.001 {
            return;
        }
        with_opacity(opacity, out, |out| {
            out.push(DrawCmd::FillRect {
                rect: self.canvas,
                radius: 0.0,
                paint: self.background.clone(),
            });
            if let Some((id, rect)) = &self.logo {
                out.push(DrawCmd::Image {
                    image_id: id.clone(),
                    rect: *rect,
                    opacity: 1.0,
                });
            }
            let (head, at) = &self.headline;
            text::draw(
                head,
                at,
                &Motion::NONE,
                usize::MAX,
                None,
                |_| self.color,
                out,
            );
            let (sub, at) = &self.sub;
            let sub_color = self.color.faded(0.75);
            text::draw(sub, at, &Motion::NONE, usize::MAX, None, |_| sub_color, out);
        });
    }
}
