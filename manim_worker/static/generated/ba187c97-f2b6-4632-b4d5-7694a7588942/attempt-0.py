from manim import *
import numpy as np

class GeneratedScene(Scene):
    def construct(self):
        shift_vec = LEFT * 1.3 + DOWN * 0.2
        c_pt = np.array([-1.2, -1.0, 0.0]) + shift_vec
        b_pt = np.array([0.6, -1.0, 0.0]) + shift_vec
        a_pt = np.array([-1.2, 1.4, 0.0]) + shift_vec
        normal_hyp = np.array([2.4, 1.8, 0.0])

        triangle = Polygon(c_pt, b_pt, a_pt, color=WHITE, stroke_width=3)
        elbow = VGroup(
            Line(c_pt + RIGHT * 0.25, c_pt + RIGHT * 0.25 + UP * 0.25, stroke_width=2, color=WHITE),
            Line(c_pt + RIGHT * 0.25 + UP * 0.25, c_pt + UP * 0.25, stroke_width=2, color=WHITE)
        )

        sq_a = Polygon(
            c_pt, b_pt, b_pt + DOWN * 1.8, c_pt + DOWN * 1.8,
            color=RED, fill_color=RED, fill_opacity=0.35, stroke_width=2.5
        )
        sq_b = Polygon(
            c_pt, a_pt, a_pt + LEFT * 2.4, c_pt + LEFT * 2.4,
            color=BLUE, fill_color=BLUE, fill_opacity=0.35, stroke_width=2.5
        )
        sq_c = Polygon(
            a_pt, b_pt, b_pt + normal_hyp, a_pt + normal_hyp,
            color=PURPLE, fill_color=PURPLE, fill_opacity=0.35, stroke_width=2.5
        )

        label_a = MathTex("9", font_size=36, color=RED).move_to(c_pt + RIGHT * 0.9 + DOWN * 0.9)
        label_b = MathTex("16", font_size=36, color=BLUE).move_to(c_pt + UP * 1.2 + LEFT * 1.2)
        label_c = MathTex("25", font_size=36, color=PURPLE).move_to((a_pt + b_pt) / 2 + normal_hyp / 2)

        eq_center = np.array([4.2, 0.0, 0.0])
        eq1 = MathTex(r"9 + 16 = 25", font_size=40).move_to(eq_center + UP * 1.2)
        eq2 = MathTex(r"3^2 + 4^2 = 5^2", font_size=40).move_to(eq_center)
        eq3 = MathTex(r"a^2 + b^2 = c^2", font_size=46, color=YELLOW).move_to(eq_center + DOWN * 1.2)
        box = SurroundingRectangle(eq3, color=GOLD, buff=0.2, stroke_width=2)

        self.play(Create(triangle), Create(elbow), run_time=1.0)
        self.play(Create(sq_a), Create(sq_b), Create(sq_c), run_time=1.5)
        self.play(
            FadeIn(label_a, scale=0.6),
            FadeIn(label_b, scale=0.6),
            FadeIn(label_c, scale=0.6),
            run_time=0.8
        )
        self.play(Write(eq1), run_time=1.0)
        self.play(Write(eq2), run_time=1.0)
        self.play(Write(eq3), Create(box), run_time=1.2)
        self.wait()