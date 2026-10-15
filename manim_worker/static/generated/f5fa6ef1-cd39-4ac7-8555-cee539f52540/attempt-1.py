from manim import *
import numpy as np

class GeneratedScene(Scene):
    def construct(self):
        title = Tex("Angles in a Triangle", font_size=38).to_edge(UP, buff=0.35)

        A = np.array([-2.5, 0.5, 0.0])
        B = np.array([2.0, 0.5, 0.0])
        C = np.array([-0.5, 2.7, 0.0])

        triangle = Polygon(A, B, C, color=WHITE, stroke_width=3)

        v_AC = C - A
        v_BC = C - B

        angle_A = np.arctan2(v_AC[1], v_AC[0])
        start_A = 0.0

        start_B = np.arctan2(v_BC[1], v_BC[0])
        angle_B = np.pi - start_B

        start_C = np.arctan2(-v_AC[1], -v_AC[0])
        angle_C = np.arctan2(-v_BC[1], -v_BC[0]) - start_C

        wedge_a = Sector(
            radius=0.7,
            start_angle=start_A,
            angle=angle_A,
            arc_center=A,
            color=TEAL,
            fill_opacity=0.6,
            stroke_width=1.5
        )
        wedge_b = Sector(
            radius=0.7,
            start_angle=start_B,
            angle=angle_B,
            arc_center=B,
            color=ORANGE,
            fill_opacity=0.6,
            stroke_width=1.5
        )
        wedge_c = Sector(
            radius=0.7,
            start_angle=start_C,
            angle=angle_C,
            arc_center=C,
            color=PURPLE,
            fill_opacity=0.6,
            stroke_width=1.5
        )

        pos_a = A + 0.38 * np.array([np.cos(start_A + angle_A / 2), np.sin(start_A + angle_A / 2), 0])
        pos_b = B + 0.38 * np.array([np.cos(start_B + angle_B / 2), np.sin(start_B + angle_B / 2), 0])
        pos_c = C + 0.38 * np.array([np.cos(start_C + angle_C / 2), np.sin(start_C + angle_C / 2), 0])

        label_a = MathTex("a", font_size=26, color=WHITE).move_to(pos_a)
        label_b = MathTex("b", font_size=26, color=WHITE).move_to(pos_b)
        label_c = MathTex("c", font_size=26, color=WHITE).move_to(pos_c)

        self.play(FadeIn(title), Create(triangle), run_time=1.0)
        self.play(
            FadeIn(wedge_a), FadeIn(wedge_b), FadeIn(wedge_c),
            Write(label_a), Write(label_b), Write(label_c),
            run_time=0.9
        )

        P = np.array([0.0, -2.0, 0.0])
        baseline = Line(LEFT * 3.2 + DOWN * 2.0, RIGHT * 3.2 + DOWN * 2.0, color=GREY, stroke_width=2.5)
        line_label = Tex(r"Straight line ($180^\circ$)", font_size=24, color=GREY).next_to(baseline, DOWN, buff=0.25)

        self.play(Create(baseline), FadeIn(line_label), run_time=0.8)

        target_a = Sector(
            radius=0.9,
            start_angle=0,
            angle=angle_A,
            arc_center=P,
            color=TEAL,
            fill_opacity=0.6,
            stroke_width=1.5
        )
        target_b = Sector(
            radius=0.9,
            start_angle=angle_A,
            angle=angle_B,
            arc_center=P,
            color=ORANGE,
            fill_opacity=0.6,
            stroke_width=1.5
        )
        target_c = Sector(
            radius=0.9,
            start_angle=angle_A + angle_B,
            angle=angle_C,
            arc_center=P,
            color=PURPLE,
            fill_opacity=0.6,
            stroke_width=1.5
        )

        t_pos_a = P + 0.52 * np.array([np.cos(angle_A / 2), np.sin(angle_A / 2), 0])
        t_pos_b = P + 0.52 * np.array([np.cos(angle_A + angle_B / 2), np.sin(angle_A + angle_B / 2), 0])
        t_pos_c = P + 0.52 * np.array([np.cos(angle_A + angle_B + angle_C / 2), np.sin(angle_A + angle_B + angle_C / 2), 0])

        t_label_a = MathTex("a", font_size=26, color=WHITE).move_to(t_pos_a)
        t_label_b = MathTex("b", font_size=26, color=WHITE).move_to(t_pos_b)
        t_label_c = MathTex("c", font_size=26, color=WHITE).move_to(t_pos_c)

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
            radius=1.1,
            start_angle=0,
            angle=np.pi,
            arc_center=P,
            color=YELLOW,
            stroke_width=2
        )
        eq = MathTex(r"a + b + c = 180^\circ", font_size=34, color=YELLOW)
        eq.next_to(straight_arc, UP, buff=0.2)

        self.play(Create(straight_arc), FadeIn(eq, shift=UP * 0.15), run_time=1.0)
        self.wait()