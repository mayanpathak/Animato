from manim import *
import numpy as np

class GeneratedScene(Scene):
    def construct(self):
        title = Text("Sum of Angles in a Triangle", font_size=36)
        title.to_edge(UP, buff=0.4)

        # Triangle vertices
        p_a = np.array([-2.4, 0.6, 0.0])
        p_b = np.array([2.4, 0.6, 0.0])
        p_c = np.array([-0.2, 2.6, 0.0])

        triangle = Polygon(p_a, p_b, p_c, color=WHITE, stroke_width=3)

        # Compute angles
        angle_a = float(np.arctan2(2.0, 2.2))
        angle_b = float(np.arctan2(2.0, 2.6))
        angle_c = float(np.pi - angle_a - angle_b)

        rad = 0.7
        sec_a = Sector(radius=rad, start_angle=0.0, angle=angle_a, arc_center=p_a,
                       color=RED, fill_opacity=0.6, stroke_width=0)
        sec_b = Sector(radius=rad, start_angle=np.pi - angle_b, angle=angle_b, arc_center=p_b,
                       color=BLUE, fill_opacity=0.6, stroke_width=0)
        sec_c = Sector(radius=rad, start_angle=float(np.arctan2(-2.0, -2.2)), angle=angle_c, arc_center=p_c,
                       color=GREEN, fill_opacity=0.6, stroke_width=0)

        lbl_a = MathTex("a", color=RED).move_to(p_a + 1.05 * np.array([np.cos(angle_a / 2), np.sin(angle_a / 2), 0.0]))
        lbl_b = MathTex("b", color=BLUE).move_to(p_b + 1.05 * np.array([np.cos(np.pi - angle_b / 2), np.sin(np.pi - angle_b / 2), 0.0]))
        mid_c_orig = float(np.arctan2(-2.0, -2.2)) + angle_c / 2
        lbl_c = MathTex("c", color=GREEN).move_to(p_c + 1.05 * np.array([np.cos(mid_c_orig), np.sin(mid_c_orig), 0.0]))

        # Destination along straight line
        p_line = np.array([0.0, -1.8, 0.0])
        line = Line(np.array([-3.2, -1.8, 0.0]), np.array([3.2, -1.8, 0.0]), color=GREY)
        straight_label = Text("Straight Line = 180°", font_size=22, color=GREY_A).next_to(line, UP, buff=0.8)

        dest_rad = 0.9
        sec_a_dest = Sector(radius=dest_rad, start_angle=0.0, angle=angle_a, arc_center=p_line,
                            color=RED, fill_opacity=0.6, stroke_width=1.5, stroke_color=RED)
        sec_c_dest = Sector(radius=dest_rad, start_angle=angle_a, angle=angle_c, arc_center=p_line,
                            color=GREEN, fill_opacity=0.6, stroke_width=1.5, stroke_color=GREEN)
        sec_b_dest = Sector(radius=dest_rad, start_angle=angle_a + angle_c, angle=angle_b, arc_center=p_line,
                            color=BLUE, fill_opacity=0.6, stroke_width=1.5, stroke_color=BLUE)

        lbl_a_dest = MathTex("a", color=RED).move_to(
            p_line + 0.55 * np.array([np.cos(angle_a / 2), np.sin(angle_a / 2), 0.0])
        )
        mid_c_dest = angle_a + angle_c / 2
        lbl_c_dest = MathTex("c", color=GREEN).move_to(
            p_line + 0.55 * np.array([np.cos(mid_c_dest), np.sin(mid_c_dest), 0.0])
        )
        mid_b_dest = angle_a + angle_c + angle_b / 2
        lbl_b_dest = MathTex("b", color=BLUE).move_to(
            p_line + 0.55 * np.array([np.cos(mid_b_dest), np.sin(mid_b_dest), 0.0])
        )

        equation = MathTex(r"a", r"+", r"b", r"+", r"c", r"=", r"180^\circ", font_size=38)
        equation[0].set_color(RED)
        equation[2].set_color(BLUE)
        equation[4].set_color(GREEN)
        equation[6].set_color(YELLOW)
        equation.next_to(line, DOWN, buff=0.5)

        # Animation sequence
        self.play(Write(title), run_time=0.8)
        self.play(
            Create(triangle),
            FadeIn(sec_a), FadeIn(sec_b), FadeIn(sec_c),
            Write(lbl_a), Write(lbl_b), Write(lbl_c),
            run_time=1.5
        )
        self.play(Create(line), FadeIn(straight_label), run_time=0.8)

        # Move angles to line
        self.play(
            TransformFromCopy(sec_a, sec_a_dest),
            TransformFromCopy(lbl_a, lbl_a_dest),
            TransformFromCopy(sec_b, sec_b_dest),
            TransformFromCopy(lbl_b, lbl_b_dest),
            TransformFromCopy(sec_c, sec_c_dest),
            TransformFromCopy(lbl_c, lbl_c_dest),
            run_time=2.0
        )

        # Concluding equation
        self.play(Write(equation), run_time=1.2)
        self.wait(1.5)