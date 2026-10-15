from manim import *
import numpy as np

class GeneratedScene(Scene):
    def construct(self):
        circle = Circle(radius=1.8, color=BLUE, fill_color=BLUE_E, fill_opacity=0.35)
        circle.shift(LEFT * 3.2)
        center_dot = Dot(circle.get_center(), color=WHITE, radius=0.06)
        radius_line = Line(circle.get_center(), circle.get_right(), color=YELLOW, stroke_width=4)
        r_label = MathTex("r", color=YELLOW, font_size=38)
        r_label.next_to(radius_line, UP, buff=0.1)

        circle_group = VGroup(circle, center_dot, radius_line, r_label)

        formula_title = MathTex(r"\text{Area of a Circle}", font_size=40, color=BLUE_B)
        formula = MathTex(r"\text{Area} = \pi r^2", font_size=46, color=YELLOW)
        
        example_header = MathTex(r"\text{Example: } r = 3", font_size=34, color=WHITE)
        step1 = MathTex(r"\text{Area} = \pi \times 3^2", font_size=38)
        step2 = MathTex(r"\text{Area} = 9\pi \approx 28.27", font_size=38, color=GREEN)
        box = SurroundingRectangle(step2, color=GREEN, buff=0.15, stroke_width=2)

        right_content = VGroup(formula_title, formula, example_header, step1, step2)
        right_content.arrange(DOWN, aligned_edge=LEFT, buff=0.32)
        right_content.shift(RIGHT * 2.8 + UP * 0.2)
        box.move_to(step2)

        self.play(
            Create(circle),
            FadeIn(center_dot),
            run_time=1.0
        )
        self.play(
            Create(radius_line),
            Write(r_label),
            run_time=0.8
        )
        self.play(
            FadeIn(formula_title, shift=DOWN * 0.2),
            Write(formula),
            circle.animate.set_fill(BLUE_D, opacity=0.5),
            run_time=1.2
        )
        self.play(
            FadeIn(example_header, shift=DOWN * 0.2),
            Write(step1),
            run_time=1.2
        )
        self.play(
            Write(step2),
            Create(box),
            run_time=1.0
        )
        self.wait()