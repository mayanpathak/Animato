from manim import *
import numpy as np

class GeneratedScene(Scene):
    def construct(self):
        title = Tex("Angles of a Triangle", font_size=40)
        title.to_edge(UP, buff=0.35)

        A = np.array([-3.0, 0.4, 0.0])
        B = np.array([2.0, 0.4, 0.0])
        C = np.array([-0.8, 2.6, 0.0])

        triangle = Polygon(A, B, C, color=WHITE, stroke_width=3)

        alpha = np.pi / 4
        beta = np.arctan(11 / 14)
        gamma = np.pi - alpha - beta

        wedge_a = Sector(
            outer_radius=0.7,
            start_angle=0,
            angle=alpha,
            arc_center=A,
            color=TEAL,
            fill_opacity=0.6,
            stroke_width=1.5
        )
        wedge_b = Sector(
            outer_radius=0.7,
            start_angle=np.pi - beta,
            angle=beta,
            arc_center=B,
            color=ORANGE,
            fill_opacity=0.6,
            stroke_width=1.5
        )
        wedge_c = Sector(
            outer_radius=0.7,
            start_angle=np.pi + alpha,
            angle=gamma,
            arc_center=C,
            color=PURPLE,
            fill_opacity=0.6,
            stroke_width=1.5
        )

        pos_a = A + 0.4 * np.array([np.cos(alpha / 2), np.sin(alpha / 2), 0])
        pos_b = B + 0.4 * np.array([np.cos(np.pi - beta / 2), np.sin(np.pi - beta / 2), 0])
        pos_c = C + 0.4 * np.array([np.cos(np.pi + alpha + gamma / 2), np.sin(np.pi + alpha + gamma / 2), 0])

        label_a = MathTex("a", font_size=26, color=WHITE).move_to(pos_a)
        label_b = MathTex("b", font_size=26, color=WHITE).move_to(pos_b)
        label_c = MathTex("c", font_size=26, color=WHITE).move_to(pos_c)

        self.play(FadeIn(title), Create(triangle), run_time=1.2)
        self.play(
            FadeIn(wedge_a), FadeIn(wedge_b), FadeIn(wedge_c),
            Write(label_a), Write(label_b), Write(label_c),
            run_time=1.0
        )

        P = np.array([0.0, -2.1, 0.0])
        baseline = Line(LEFT * 3.5 + DOWN * 2.1, RIGHT * 3.5 + DOWN * 2.1, color=GREY, stroke_width=2.5)
        line_label = Tex(r"Straight line ($180^\circ$)", font_size=24, color=GREY).next_to(baseline, DOWN, buff=0.25)

        self.play(Create(baseline), FadeIn(line_label), run_time=0.8)

        target_a = Sector(
            outer_radius=1.0,
            start_angle=0,
            angle=alpha,
            arc_center=P,
            color=TEAL,
            fill_opacity=0.6,
            stroke_width=1.5
        )
        target_b = Sector(
            outer_radius=1.0,
            start_angle=alpha,
            angle=beta,
            arc_center=P,
            color=ORANGE,
            fill_opacity=0.6,
            stroke_width=1.5
        )
        target_c = Sector(
            outer_radius=1.0,
            start_angle=alpha + beta,
            angle=gamma,
            arc_center=P,
            color=PURPLE,
            fill_opacity=0.6,
            stroke_width=1.5
        )

        t_pos_a = P + 0.6 * np.array([np.cos(alpha / 2), np.sin(alpha / 2), 0])
        t_pos_b = P + 0.6 * np.array([np.cos(alpha + beta / 2), np.sin(alpha + beta / 2), 0])
        t_pos_c = P + 0.6 * np.array([np.cos(alpha + beta + gamma / 2), np.sin(alpha + beta + gamma / 2), 0])

        t_label_a = MathTex("a", font_size=28, color=WHITE).move_to(t_pos_a)
        t_label_b = MathTex("b", font_size=28, color=WHITE).move_to(t_pos_b)
        t_label_c = MathTex("c", font_size=28, color=WHITE).move_to(t_pos_c)

        copy_a = wedge_a.copy()
        copy_b = wedge_b.copy()
        copy_c = wedge_c.copy()
        copy_la = label_a.copy()
        copy_lb = label_b.copy()
        copy_lc = label_c.copy()

        self.play(
            Transform(copy_a, target_a),
            Transform(copy_b, target_b),
            Transform(copy_c, target_c),
            Transform(copy_la, t_label_a),
            Transform(copy_lb, t_label_b),
            Transform(copy_lc, t_label_c),
            run_time=2.0
        )

        straight_arc = Arc(
            radius=1.2,
            start_angle=0,
            angle=np.pi,
            arc_center=P,
            color=YELLOW,
            stroke_width=2.5
        )
        eq = MathTex(r"a + b + c = 180^\circ", font_size=36, color=YELLOW)
        eq.next_to(straight_arc, UP, buff=0.2)

        self.play(Create(straight_arc), FadeIn(eq, shift=UP * 0.2), run_time=1.0)
        self.wait()