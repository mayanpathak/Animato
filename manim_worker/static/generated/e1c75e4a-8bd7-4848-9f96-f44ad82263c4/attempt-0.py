from manim import *
import numpy as np

class GeneratedScene(Scene):
    def construct(self):
        title = Text("Transformer AI Infrastructure", font_size=40, color=WHITE).to_edge(UP)
        self.play(Write(title), run_time=0.8)

        # High-level pipeline blocks
        stages = ["Compute Cluster", "Distributed Engine", "Transformer Layer"]
        colors = [BLUE, PURPLE, TEAL]
        boxes = VGroup()

        for label_text, col in zip(stages, colors):
            box = RoundedRectangle(corner_radius=0.15, height=1.2, width=3.4, color=col, fill_opacity=0.2)
            lbl = Text(label_text, font_size=22, color=WHITE)
            boxes.add(VGroup(box, lbl))

        boxes.arrange(DOWN, buff=0.6).shift(DOWN * 0.3)
        arrows = VGroup(
            Arrow(boxes[0].get_bottom(), boxes[1].get_top(), buff=0.1, color=GRAY),
            Arrow(boxes[1].get_bottom(), boxes[2].get_top(), buff=0.1, color=GRAY)
        )

        self.play(LaggedStart(*[FadeIn(b, shift=DOWN * 0.3) for b in boxes], lag_ratio=0.2), run_time=1.5)
        self.play(Create(arrows), run_time=0.8)

        # Transition into Distributed Parallelism zoom
        parallel_title = Text("3D Parallelism Stack", font_size=32, color=YELLOW).to_edge(UP)
        
        tp_box = RoundedRectangle(corner_radius=0.15, height=2.2, width=2.4, color=BLUE, fill_opacity=0.3)
        tp_txt = Text("Tensor\nParallel\n(TP)", font_size=20, line_spacing=0.8)
        tp_grp = VGroup(tp_box, tp_txt)

        pp_box = RoundedRectangle(corner_radius=0.15, height=2.2, width=2.4, color=PURPLE, fill_opacity=0.3)
        pp_txt = Text("Pipeline\nParallel\n(PP)", font_size=20, line_spacing=0.8)
        pp_grp = VGroup(pp_box, pp_txt)

        dp_box = RoundedRectangle(corner_radius=0.15, height=2.2, width=2.4, color=TEAL, fill_opacity=0.3)
        dp_txt = Text("Data / ZeRO\nParallel\n(DP)", font_size=20, line_spacing=0.8)
        dp_grp = VGroup(dp_box, dp_txt)

        parallel_grid = VGroup(tp_grp, pp_grp, dp_grp).arrange(RIGHT, buff=0.5).shift(UP * 0.2)
        
        interconnect = MathTex(r"\text{NVLink} \longleftrightarrow \text{InfiniBand}", font_size=28, color=GOLD)
        interconnect.next_to(parallel_grid, DOWN, buff=0.6)

        self.play(
            FadeOut(arrows),
            Transform(title, parallel_title),
            ReplacementTransform(boxes, parallel_grid),
            run_time=1.5
        )
        self.play(FadeIn(interconnect, shift=UP * 0.2), run_time=0.8)

        # Core math operation behind infrastructure workload
        math_label = MathTex(
            r"\text{Attention: } \mathrm{Softmax}\left(\frac{Q K^T}{\sqrt{d_k}}\right) V",
            font_size=34,
            color=WHITE
        ).shift(DOWN * 2.2)

        self.play(
            parallel_grid.animate.scale(0.85).shift(UP * 0.3),
            interconnect.animate.scale(0.85).shift(UP * 0.3),
            Write(math_label),
            run_time=1.5
        )
        self.wait()