"""Shared geometry/timing contract for the fictional CAM-404 recording."""
import math

PERIOD = 12
SPEED = 1.2
START_Y = 9.3
CART_X = -0.35
ROOM_ROWS = (1.5, 4.5, 7.5, 10.5)
CURTAIN_Y = (5.45, 6.75)  # Solid wall between 404 and 406, never a doorway.
DOOR_404_ANGLE = math.radians(12)


def distance_at(t):
    return SPEED * max(0, min(PERIOD, t))


def cart_y(t):
    return START_Y - distance_at(t)


def foot_pose(t, side):
    # Each planted foot remains fixed in world space during the stance phase.
    cycle = .92
    phase = (t / cycle + (0 if side < 0 else .5)) % 1
    stride = SPEED * cycle
    if phase < .5:
        return -stride / 4 + phase * stride, .075
    swing = (phase - .5) * 2
    return stride / 4 - swing * stride / 2, .075 + .10 * math.sin(math.pi * swing)
