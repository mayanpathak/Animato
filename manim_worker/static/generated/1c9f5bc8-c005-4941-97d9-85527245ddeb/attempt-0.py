from manim import *
import numpy as np

class GeneratedScene(Scene):
    def construct(self):
        title = Text("Sum of Angles in a Triangle", font_size=34, color=WHITE)
        title.to_edge(UP, buff=0.4)

        A = np.array([-2.5, 0.8, 0])
        B = np.array([2.0, 0.8, 0])
        C = np.array([-0.3, 2.7, 0])

        v_AC = C - A
        angle_a = np.arctan2(v_AC[1], v_AC[0])

        v_BC = C - B
        angle_b = np.pi - np.arctan2(v_BC[1], v_BC[0])

        angle_c = np.pi - angle_a - angle_b

        v_CA = A - C
        start_angle_c = np.arctan2(v_CA[1], v_CA[0])

        col_a = RED
        col_b = BLUE
        col_c = GREEN

        triangle = Polygon(A, B, C, color=WHITE, stroke_width=3)

        r_tri = 0.55
        wedge_a = Sector(
            radius=r_tri, arc_center=A, start_angle=0,
            angle=angle_a, color=col_a, fill_opacity=0.6,
            stroke_color=col_a, stroke_width=2
        )
        wedge_b = Sector(
            radius=r_tri, arc_center=B, start_angle=np.pi - angle_b,
            angle=angle_b, color=col_b, fill_opacity=0.6,
            stroke_color=col_b, stroke_width=2
        )
        wedge_c = Sector(
            radius=r_tri, arc_center=C, start_angle=start_angle_c,
            angle=angle_c, color=col_c, fill_opacity=0.6,
            stroke_color=col_c, stroke_width=2
        )

        dir_a = np.array([np.cos(angle_a / 2), np.sin(angle_a / 2), 0])
        dir_b = np.array([np.cos(np.pi - angle_b / 2), np.sin(np.pi - angle_b / 2), 0])
        dir_c = np.array([np.cos(start_angle_c + angle_c / 2), np.sin(start_angle_c + angle_c / 2), 0])

        label_a = MathTex("a", color=col_a, font_size=32).move_to(A + dir_a * 0.85)
        label_b = MathTex("b", color=col_b, font_size=32).move_to(B + dir_b * 0.85)
        label_c = MathTex("c", color=col_c, font_size=32).move_to(C + dir_c * 0.85)

        P = np.array([0, -1.2, 0])
        baseline = Line(start=P + LEFT * 3.0, end=P + RIGHT * 3.0, color=WHITE, stroke_width=2.5)
        center_dot = Dot(point=P, radius=0.06, color=WHITE)

        r_target = 0.95
        target_wedge_a = Sector(
            radius=r_target, arc_center=P, start_angle=0,
            angle=angle_a, color=col_a, fill_opacity=0.6,
            stroke_color=col_a, stroke_width=2
        )
        target_wedge_c = Sector(
            radius=r_target, arc_center=P, start_angle=angle_a,
            angle=angle_c, color=col_c, fill_opacity=0.6,
            stroke_color=col_c, stroke_width=2
        )
        target_wedge_b = Sector(
            radius=r_target, arc_center=P, start_angle=angle_a + angle_c,
            angle=angle_b, color=col_b, fill_opacity=0.6,
            stroke_color=col_b, stroke_width=2
        )

        mid_a = angle_a / 2
        mid_c = angle_a + angle_c / 2
        mid_b = angle_a + angle_c + angle_b / 2
        dist_label = 1.3

        target_label_a = MathTex("a", color=col_a, font_size=32).move_to(
            P + dist_label * np.array([np.cos(mid_a), np.sin(mid_a), 0])
        )
        target_label_c = MathTex("c", color=col_c, font_size=32).move_to(
            P + dist_label * np.array([np.cos(mid_c), np.sin(mid_c), 0])
        )
        target_label_b = MathTex("b", color=col_b, font_size=32).move_to(
            P + dist_label * np.array([np.cos(mid_b), np.sin(mid_b), 0])
        )

        eq = MathTex(r"a + b + c = 180^\circ", font_size=38, color=YELLOW)
        eq.next_to(baseline, DOWN, buff=0.5)

        note = Text("Angles on a straight line = 180°", font_size=24, color=GRAY)
        note.next_to(eq, DOWN, buff=0.3)

        wedge_a_copy = wedge_a.copy()
        wedge_b_copy = wedge_b.copy()
        wedge_c_copy = wedge_c.copy()
        label_a_copy = label_a.copy()
        label_b_copy = label_b.copy()
        label_c_copy = label_c.copy()

        self.play(Write(title), Create(triangle), run_time=1.2)
        self.play(
            FadeIn(wedge_a), FadeIn(wedge_b), FadeIn(wedge_c),
            Write(label_a), Write(label_b), Write(label_c),
            run_time=1.0
        )
        self.play(Create(baseline), FadeIn(center_dot), run_time=0.8)

        self.add(wedge_a_copy, wedge_b_copy, wedge_c_copy, label_a_copy, label_b_copy, label_c_copy)
        self.play(
            Transform(wedge_a_copy, target_wedge_a),
            Transform(wedge_b_copy, target_wedge_b),
            Transform(wedge_c_copy, target_wedge_c),
            Transform(label_a_copy, target_label_a),
            Transform(label_b_copy, target_label_b),
            Transform(label_c_copy, target_label_c),
            run_time=2.0
        )
        self.play(Write(eq), FadeIn(note, shift=UP * 0.2), run_time=1.2)
        self.wait()