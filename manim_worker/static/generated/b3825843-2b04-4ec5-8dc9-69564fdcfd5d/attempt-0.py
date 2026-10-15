from manim import *
import numpy as np

class GeneratedScene(Scene):
    def construct(self):
        p_c = np.array([0.0, 0.0, 0.0])
        p_b = np.array([1.8, 0.0, 0.0])
        p_a = np.array([0.0, 1.35, 0.0])

        triangle = Polygon(p_c, p_b, p_a, color=WHITE, stroke_width=3)
        elbow = VGroup(
            Line(np.array([0.2, 0.0, 0.0]), np.array([0.2, 0.2, 0.0]), stroke_width=2, color=WHITE),
            Line(np.array([0.2, 0.2, 0.0]), np.array([0.0, 0.2, 0.0]), stroke_width=2, color=WHITE),
        )

        sq_a = Polygon(
            p_c,
            np.array([-1.35, 0.0, 0.0]),
            np.array([-1.35, 1.35, 0.0]),
            p_a,
            color=RED,
            fill_color=RED,
            fill_opacity=0.4,
            stroke_width=2,
        )
        label_a = MathTex("9", color=RED, font_size=36).move_to(sq_a.get_center())

        sq_b = Polygon(
            p_c,
            p_b,
            np.array([1.8, -1.8, 0.0]),
            np.array([0.0, -1.8, 0.0]),
            color=BLUE,
            fill_color=BLUE,
            fill_opacity=0.4,
            stroke_width=2,
        )
        label_b = MathTex("16", color=BLUE, font_size=36).move_to(sq_b.get_center())

        norm = np.array([1.35, 1.8, 0.0])
        sq_c = Polygon(
            p_a,
            p_b,
            p_b + norm,
            p_a + norm,
            color=PURPLE,
            fill_color=PURPLE,
            fill_opacity=0.4,
            stroke_width=2,
        )
        label_c = MathTex("25", color=PURPLE, font_size=36).move_to(sq_c.get_center())

        geom = VGroup(triangle, elbow, sq_a, sq_b, sq_c, label_a, label_b, label_c)
        geom.move_to(LEFT * 2.8)

        eq_areas = MathTex("9", "+", "16", "=", "25", font_size=44)
        eq_areas.move_to(RIGHT * 3.0 + UP * 0.8)
        eq_areas[0].set_color(RED)
        eq_areas[2].set_color(BLUE)
        eq_areas[4].set_color(PURPLE)

        eq_powers = MathTex("3^2", "+", "4^2", "=", "5^2", font_size=44)
        eq_powers.move_to(RIGHT * 3.0 + UP * 0.8)
        eq_powers[0].set_color(RED)
        eq_powers[2].set_color(BLUE)
        eq_powers[4].set_color(PURPLE)

        eq_final = MathTex("a^2", "+", "b^2", "=", "c^2", font_size=52, color=YELLOW)
        eq_final.move_to(RIGHT * 3.0 + DOWN * 0.8)
        box = SurroundingRectangle(eq_final, color=YELLOW, buff=0.25)

        self.play(Create(triangle), Create(elbow), run_time=1.0)
        self.play(
            FadeIn(sq_a),
            FadeIn(label_a),
            FadeIn(sq_b),
            FadeIn(label_b),
            run_time=1.2,
        )
        self.play(FadeIn(sq_c), FadeIn(label_c), run_time=1.0)
        self.play(Write(eq_areas), run_time=1.0)
        self.play(ReplacementTransform(eq_areas, eq_powers), run_time=1.0)
        self.play(FadeIn(eq_final, shift=UP), Create(box), run_time=1.2)
        self.wait()