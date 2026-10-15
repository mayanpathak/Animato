from manim import *
import numpy as np

class GeneratedScene(Scene):
    def construct(self):
        pA = 2 * LEFT + DOWN
        pB = 2 * RIGHT + DOWN
        pC = 2 * LEFT + 2 * UP

        triangle = Polygon(pA, pB, pC, color=WHITE, stroke_width=4)
        square_4 = Polygon(pA, pB, pB + 4 * DOWN, pA + 4 * DOWN, color=BLUE, fill_opacity=0.4, stroke_width=3)
        area_4_text = MathTex("16", color=BLUE_A).move_to(square_4.get_center())
        square_3 = Polygon(pA, pC, pC + 3 * LEFT, pA + 3 * LEFT, color=GREEN, fill_opacity=0.4, stroke_width=3)
        area_3_text = MathTex("9", color=GREEN_A).move_to(square_3.get_center())
        vec_BC = pC - pB
        perp_vec_outward = normalize(rotate_vector(vec_BC, PI/2)) * 5
        square_5 = Polygon(pB, pC, pC + perp_vec_outward, pB + perp_vec_outward, color=RED, fill_opacity=0.4, stroke_width=3)
        area_5_text = MathTex("25", color=RED_A).move_to(square_5.get_center())

        pythagorean_equation = MathTex("a^2 + b^2 = c^2", color=YELLOW)

        self.play(Create(triangle), run_time=1.0)
        self.play(Create(square_3), Create(square_4), Create(square_5), run_time=1.5)
        self.play(FadeIn(area_3_text), FadeIn(area_4_text), FadeIn(area_5_text), run_time=1.0)
        self.wait(0.5)
        self.play(VGroup(square_3, area_3_text, square_4, area_4_text).animate.set_color(YELLOW), run_time=1.0)
        self.play(VGroup(square_5, area_5_text).animate.set_color(ORANGE), run_time=1.0)
        self.wait(0.5)
        self.play(FadeOut(triangle, square_3, square_4, square_5, area_3_text, area_4_text, area_5_text), Write(pythagorean_equation.move_to(ORIGIN)), run_time=2.0)
        self.wait()