from manim import *
import numpy as np

class GeneratedScene(Scene):
    def construct(self):
        title = Text("Pythagorean Theorem", font_size=36).to_edge(UP, buff=0.5)

        v_c = np.array([0.0, 0.0, 0.0])
        v_a = np.array([1.8, 0.0, 0.0])
        v_b = np.array([0.0, 1.35, 0.0])

        tri = Polygon(
            v_c, v_a, v_b,
            color=WHITE,
            stroke_width=3,
            fill_opacity=0.2,
            fill_color=GREY
        )

        ra_size = 0.2
        ra = Polyline(
            v_c + np.array([ra_size, 0, 0]),
            v_c + np.array([ra_size, ra_size, 0]),
            v_c + np.array([0, ra_size, 0]),
            color=WHITE,
            stroke_width=2
        )

        sq_a = Polygon(
            v_c, v_b, v_b + np.array([-1.35, 0, 0]), v_c + np.array([-1.35, 0, 0]),
            color=RED,
            fill_opacity=0.4,
            stroke_width=2.5
        )
        lbl_a = MathTex("9", color=RED, font_size=32).move_to(sq_a.get_center())

        sq_b = Polygon(
            v_c, v_a, v_a + np.array([0, -1.8, 0]), v_c + np.array([0, -1.8, 0]),
            color=BLUE,
            fill_opacity=0.4,
            stroke_width=2.5
        )
        lbl_b = MathTex("16", color=BLUE, font_size=32).move_to(sq_b.get_center())

        disp = np.array([1.35, 1.8, 0])
        sq_c = Polygon(
            v_b, v_a, v_a + disp, v_b + disp,
            color=YELLOW,
            fill_opacity=0.4,
            stroke_width=2.5
        )
        lbl_c = MathTex("25", color=YELLOW, font_size=32).move_to(sq_c.get_center())

        diagram = VGroup(tri, ra, sq_a, lbl_a, sq_b, lbl_b, sq_c, lbl_c)
        diagram.scale(0.85).to_edge(LEFT, buff=1.0)

        eq_pos = np.array([3.2, 0.0, 0.0])

        eq1 = MathTex("9", "+", "16", "=", "25", font_size=42).move_to(eq_pos)
        eq1[0].set_color(RED)
        eq1[2].set_color(BLUE)
        eq1[4].set_color(YELLOW)

        eq2 = MathTex("3^2", "+", "4^2", "=", "5^2", font_size=42).move_to(eq_pos)
        eq2[0].set_color(RED)
        eq2[2].set_color(BLUE)
        eq2[4].set_color(YELLOW)

        eq3 = MathTex("a^2", "+", "b^2", "=", "c^2", font_size=46).move_to(eq_pos)
        eq3[0].set_color(RED)
        eq3[2].set_color(BLUE)
        eq3[4].set_color(YELLOW)

        box = SurroundingRectangle(eq3, color=YELLOW, buff=0.25, stroke_width=2.5)

        self.play(FadeIn(title, shift=DOWN * 0.3), run_time=0.7)
        self.play(Create(tri), Create(ra), run_time=1.0)
        self.play(
            FadeIn(sq_a), Write(lbl_a),
            FadeIn(sq_b), Write(lbl_b),
            FadeIn(sq_c), Write(lbl_c),
            run_time=1.5
        )
        self.play(FadeIn(eq1, shift=UP * 0.3), run_time=0.8)
        self.play(ReplacementTransform(eq1, eq2), run_time=1.0)
        self.play(
            ReplacementTransform(eq2, eq3),
            Create(box),
            run_time=1.2
        )
        self.wait(1.5)