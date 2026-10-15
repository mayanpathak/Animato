from manim import *
import numpy as np

class GeneratedScene(Scene):
    def construct(self):
        circle = Circle(radius=1.6, color=BLUE).shift(LEFT * 3.2)
        center_dot = Dot(circle.get_center(), color=WHITE)
        rad_line = Line(circle.get_center(), circle.get_center() + RIGHT * 1.6, color=YELLOW)
        r_label = MathTex("r", font_size=36, color=YELLOW).next_to(rad_line, UP, buff=0.15)

        formula = MathTex(r"\text{Area} = \pi r^2", font_size=42)
        ex_label = MathTex(r"\text{Example: } r = 3", font_size=34, color=YELLOW)
        step1 = MathTex(r"\text{Area} = \pi \times 3^2", font_size=36)
        step2 = MathTex(r"\text{Area} = 9\pi \approx 28.27", font_size=36, color=GREEN)

        right_group = VGroup(formula, ex_label, step1, step2)
        right_group.arrange(DOWN, aligned_edge=LEFT, buff=0.4)
        right_group.shift(RIGHT * 2.8)

        box = SurroundingRectangle(step2, color=GREEN, buff=0.15)

        self.play(Create(circle), FadeIn(center_dot), run_time=1.0)
        self.play(Create(rad_line), Write(r_label), run_time=0.8)
        self.play(
            Write(formula),
            circle.animate.set_fill(BLUE, opacity=0.25),
            run_time=1.2
        )
        self.play(FadeIn(ex_label, shift=DOWN * 0.2), run_time=0.8)
        self.play(Write(step1), run_time=1.0)
        self.play(Write(step2), run_time=1.0)
        self.play(Create(box), run_time=0.8)
        self.wait()