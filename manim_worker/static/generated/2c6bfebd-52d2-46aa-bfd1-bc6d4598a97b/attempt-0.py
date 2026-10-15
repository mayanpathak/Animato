from manim import *
import numpy as np

class GeneratedScene(Scene):
    def construct(self):
        circle = Circle(radius=1.8, color=TEAL, fill_opacity=0.25).shift(LEFT * 3)
        center_dot = Dot(circle.get_center(), color=WHITE)
        radius_line = Line(circle.get_center(), circle.get_right(), color=YELLOW, stroke_width=4)
        radius_label = MathTex("r", color=YELLOW, font_size=36).next_to(radius_line, UP, buff=0.1)
        circle_group = VGroup(circle, center_dot, radius_line, radius_label)

        formula_title = MathTex(r"\text{Area of a Circle}", font_size=40, color=BLUE_B)
        formula = MathTex(r"A = \pi r^2", font_size=48)
        formula_box = SurroundingRectangle(formula, color=BLUE, buff=0.2, corner_radius=0.1)
        header_group = VGroup(formula_title, formula).arrange(DOWN, buff=0.3)
        right_panel = VGroup(header_group, formula_box).shift(RIGHT * 3 + UP * 1.5)
        formula_box.move_to(formula)

        ex_given = MathTex(r"\text{Example: } r = 3\text{ cm}", font_size=36, color=YELLOW)
        ex_step1 = MathTex(r"A = \pi \times 3^2", font_size=38)
        ex_step2 = MathTex(r"A = 9\pi \approx 28.27\text{ cm}^2", font_size=38, color=GREEN)
        example_group = VGroup(ex_given, ex_step1, ex_step2).arrange(DOWN, buff=0.3, aligned_edge=LEFT)
        example_group.next_to(formula_box, DOWN, buff=0.6).align_to(header_group, LEFT)

        self.play(
            Create(circle),
            FadeIn(center_dot, scale=0.5),
            run_time=1.2
        )
        self.play(
            Create(radius_line),
            Write(radius_label),
            run_time=0.8
        )
        self.play(
            FadeIn(formula_title, shift=DOWN * 0.3),
            Write(formula),
            Create(formula_box),
            run_time=1.5
        )
        self.play(
            FadeIn(ex_given, shift=RIGHT * 0.3),
            run_time=0.8
        )
        self.play(
            Write(ex_step1),
            run_time=1.0
        )
        self.play(
            TransformMatchingTex(ex_step1.copy(), ex_step2),
            run_time=1.2
        )
        self.wait()