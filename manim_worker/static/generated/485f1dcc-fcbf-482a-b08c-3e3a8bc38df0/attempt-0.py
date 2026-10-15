from manim import *
import numpy as np

class GeneratedScene(Scene):
    def construct(self):
        title = Text("Integer Addition on a Number Line", font_size=32)
        title.to_edge(UP, buff=0.5)

        eq_unsolved = MathTex(r"-3 + 5 = \text{?}", font_size=44)
        eq_unsolved.next_to(title, DOWN, buff=0.3)

        number_line = NumberLine(
            x_range=[-10, 10, 1],
            length=11.5,
            include_numbers=True,
            numbers_to_include=range(-10, 11, 2),
        )
        number_line.shift(DOWN * 0.3)

        self.play(
            Write(title),
            Write(eq_unsolved),
            Create(number_line),
            run_time=1.5,
        )

        dot = Dot(number_line.n2p(-3), color=YELLOW, radius=0.12)
        start_label = MathTex(r"\text{Start: } -3", font_size=24, color=YELLOW)
        start_label.next_to(number_line.n2p(-3), DOWN, buff=0.8)

        self.play(
            FadeIn(dot, scale=1.5),
            FadeIn(start_label, shift=UP * 0.2),
            run_time=1.0,
        )

        dashed_start = DashedLine(
            number_line.n2p(-3),
            number_line.n2p(-3) + UP * 0.8,
            color=GRAY,
        )
        dashed_end = DashedLine(
            number_line.n2p(2),
            number_line.n2p(2) + UP * 0.8,
            color=GRAY,
        )
        step_arrow = Arrow(
            start=number_line.n2p(-3) + UP * 0.8,
            end=number_line.n2p(2) + UP * 0.8,
            buff=0,
            color=GREEN,
        )
        step_label = MathTex(r"+5\text{ steps}", font_size=26, color=GREEN)
        step_label.next_to(step_arrow, UP, buff=0.15)

        self.play(
            Create(dashed_start),
            Create(dashed_end),
            GrowArrow(step_arrow),
            FadeIn(step_label),
            dot.animate.move_to(number_line.n2p(2)),
            run_time=2.0,
        )

        eq_solved = MathTex(r"-3 + 5 = 2", font_size=44)
        eq_solved.next_to(title, DOWN, buff=0.3)
        box = SurroundingRectangle(eq_solved, color=YELLOW, buff=0.12)

        end_label = MathTex(r"\text{Land on: } 2", font_size=24, color=GREEN)
        end_label.next_to(number_line.n2p(2), DOWN, buff=0.8)

        self.play(
            ReplacementTransform(eq_unsolved, eq_solved),
            ReplacementTransform(start_label, end_label),
            dot.animate.set_color(GREEN),
            Create(box),
            run_time=1.2,
        )

        self.wait()