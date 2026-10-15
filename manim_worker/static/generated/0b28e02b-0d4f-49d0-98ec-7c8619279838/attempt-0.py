from manim import *
import numpy as np

class GeneratedScene(Scene):
    def construct(self):
        title = Text("Adding Integers on a Number Line", font_size=32).to_edge(UP, buff=0.8)
        eq = MathTex(r"-3 + 5", font_size=40).next_to(title, DOWN, buff=0.3)

        number_line = NumberLine(
            x_range=[-10, 10, 1],
            length=11.5,
            include_numbers=True,
            decimal_number_config={"font_size": 18},
        ).shift(DOWN * 0.5)

        self.play(Write(title), Create(number_line), run_time=1.5)
        self.play(Write(eq), run_time=0.8)

        dot = Dot(number_line.n2p(-3), color=RED, radius=0.12)
        start_label = Text("Start at -3", font_size=20, color=RED).next_to(dot, UP, buff=0.4)

        self.play(FadeIn(dot, scale=1.5), FadeIn(start_label, shift=DOWN * 0.2), run_time=0.8)

        arrow = Arrow(
            start=number_line.n2p(-3) + UP * 0.7,
            end=number_line.n2p(2) + UP * 0.7,
            buff=0,
            color=YELLOW,
            stroke_width=4,
        )
        jump_label = MathTex(r"+5", color=YELLOW, font_size=32).next_to(arrow, UP, buff=0.15)

        self.play(
            FadeOut(start_label),
            Create(arrow),
            Write(jump_label),
            dot.animate.move_to(number_line.n2p(2)).set_color(GREEN),
            run_time=1.8,
        )

        eq_result = MathTex(r"-3 + 5 = 2", font_size=40).next_to(title, DOWN, buff=0.3)
        result_circle = Circle(radius=0.28, color=GREEN, stroke_width=3).move_to(number_line.n2p(2))

        self.play(
            TransformMatchingTex(eq, eq_result),
            Create(result_circle),
            run_time=1.0,
        )
        self.wait(1.5)