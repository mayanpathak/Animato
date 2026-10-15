from manim import *
import numpy as np

class GeneratedScene(Scene):
    def construct(self):
        title = Text("Pythagorean Theorem", font_size=36).to_edge(UP, buff=0.5)

        v_c = np.array([-3.2, -0.6, 0.0])
        v_a = np.array([-1.4, -0.6, 0.0])
        v_b = np.array([-3.2, 0.75, 0.0])

        tri = Polygon(
            v_c, v_a, v_b,
            color=WHITE,
            stroke_width=3,
            fill_opacity=0.2,
            fill_color=GREY
        )

        ra = Square(
            side_length=0.2,
            stroke_width=2,
            color=WHITE,
            fill_opacity=0
        ).move_to(v_c + np.array([0.1, 0.1, 0.0]))

        sq_a = Polygon(
            v_c, v_b, v_b + LEFT * 1.35, v_c + LEFT * 1.35,
            color=RED,
            fill_opacity=0.35,
            stroke_width=2.5
        )
        lbl_a = MathTex("9", color=RED, font_size=32).move_to(sq_a.get_center())

        sq_b = Polygon(
            v_c, v_a, v_a + DOWN * 1.8, v_c + DOWN * 1.8,
            color=BLUE,
            fill_opacity=0.35,
            stroke_width=2.5
        )
        lbl_b = MathTex("16", color=BLUE, font_size=32).move_to(sq_b.get_center())

        disp = np.array([1.35, 1.8, 0.0])
        sq_c = Polygon(
            v_b, v_a, v_a + disp, v_b + disp,
            color=YELLOW,
            fill_opacity=0.35,
            stroke_width=2.5
        )
        lbl_c = MathTex("25", color=YELLOW, font_size=32).move_to(sq_c.get_center())

        eq1 = MathTex(r"9", r"+", r"16", r"=", r"25", font_size=40).move_to(RIGHT * 3.0 + UP * 1.0)
        eq1.set_color_by_tex("9", RED)
        eq1.set_color_by_tex("16", BLUE)
        eq1.set_color_by_tex("25", YELLOW)

        eq2 = MathTex(r"3^2", r"+", r"4^2", r"=", r"5^2", font_size=40).move_to(RIGHT * 3.0 + UP * 1.0)
        eq2.set_color_by_tex("3^2", RED)
        eq2.set_color_by_tex("4^2", BLUE)
        eq2.set_color_by_tex("5^2", YELLOW)

        eq3 = MathTex(r"a^2", r"+", r"b^2", r"=", r"c^2", font_size=46).move_to(RIGHT * 3.0 + DOWN * 0.8)
        eq3.set_color_by_tex("a^2", RED)
        eq3.set_color_by_tex("b^2", BLUE)
        eq3.set_color_by_tex("c^2", YELLOW)

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
            FadeIn(eq3, shift=UP * 0.2),
            Create(box),
            run_time=1.0
        )
        self.wait(1.5)