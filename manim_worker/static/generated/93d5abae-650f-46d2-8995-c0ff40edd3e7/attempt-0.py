from manim import *
import numpy as np

class GeneratedScene(Scene):
    def construct(self):
        title = Text("Adding Integers on a Number Line", font_size=36, color=WHITE).to_edge(UP, buff=0.5)

        eq1 = MathTex(r"-3 + 5 = \text{?}", font_size=42).next_to(title, DOWN, buff=0.4)
        eq2 = MathTex(r"-3 + 5 = 2", font_size=42).next_to(title, DOWN, buff=0.4)
        eq2.set_color_by_tex("2", GREEN)

        nl = NumberLine(
            x_range=[-10, 10, 1],
            length=12,
            include_numbers=True,
            font_size=18,
        ).shift(DOWN * 1.0)

        p_start = nl.n2p(-3)
        p_end = nl.n2p(2)
        arrow_y_offset = UP * 0.85

        dash_start = DashedLine(p_start, p_start + arrow_y_offset, color=RED, stroke_width=2)
        dash_end = DashedLine(p_end, p_end + arrow_y_offset, color=GREEN, stroke_width=2)

        hop_arrow = Arrow(
            start=p_start + arrow_y_offset,
            end=p_end + arrow_y_offset,
            color=YELLOW,
            buff=0,
            stroke_width=4,
            max_tip_length_to_length_ratio=0.15,
        )
        step_label = MathTex(r"+5\text{ steps to the right}", font_size=26, color=YELLOW).next_to(
            hop_arrow, UP, buff=0.15
        )

        dot_start = Dot(p_start, color=RED, radius=0.1)
        dot_end = Dot(p_end, color=GREEN, radius=0.1)

        box = SurroundingRectangle(eq2, color=GREEN, buff=0.15, corner_radius=0.1)

        self.play(FadeIn(title, shift=DOWN), Create(nl), run_time=1.2)
        self.play(Write(eq1), run_time=0.8)

        self.play(FadeIn(dot_start, scale=1.5), Create(dash_start), run_time=0.8)
        self.play(
            GrowArrow(hop_arrow),
            FadeIn(step_label, shift=UP * 0.2),
            run_time=1.2,
        )
        self.play(Create(dash_end), FadeIn(dot_end, scale=1.5), run_time=0.8)

        self.play(TransformMatchingTex(eq1, eq2), run_time=1.0)
        self.play(Create(box), run_time=0.8)
        self.wait()