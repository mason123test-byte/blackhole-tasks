use serde::{Deserialize, Serialize};
#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Rect {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}
#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlacementInput {
    pub orb_rect: Rect,
    pub monitor_work_area: Rect,
    pub preferred_workspace_width: u32,
    pub preferred_workspace_height: u32,
    pub gap: u32,
}
#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PlacementResult {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    pub direction: String,
}
pub fn calculate(input: PlacementInput) -> PlacementResult {
    let area = input.monitor_work_area;
    let right = area.x + area.width as i32 - (input.orb_rect.x + input.orb_rect.width as i32);
    let left = input.orb_rect.x - area.x;
    let below = area.y + area.height as i32 - (input.orb_rect.y + input.orb_rect.height as i32);
    let above = input.orb_rect.y - area.y;
    let preferred_width = input.preferred_workspace_width.min(area.width);
    let preferred_height = input.preferred_workspace_height.min(area.height);
    let gap = input.gap as i32;
    let fits_right = right >= preferred_width as i32 + gap;
    let fits_left = left >= preferred_width as i32 + gap;
    let fits_below = below >= preferred_height as i32 + gap;
    let fits_above = above >= preferred_height as i32 + gap;
    let fallback = [
        ("right", right.saturating_sub(gap) as i64 * area.height as i64, 4_i64),
        ("left", left.saturating_sub(gap) as i64 * area.height as i64, 3_i64),
        ("bottom", below.saturating_sub(gap) as i64 * area.width as i64, 2_i64),
        ("top", above.saturating_sub(gap) as i64 * area.width as i64, 1_i64),
    ]
    .into_iter()
    .max_by_key(|(_, capacity, priority)| capacity.saturating_mul(10) + priority)
    .map(|(direction, _, _)| direction)
    .unwrap_or("right");
    let direction = if fits_right {
        "right"
    } else if fits_left {
        "left"
    } else if fits_below {
        "bottom"
    } else if fits_above {
        "top"
    } else {
        fallback
    };
    let horizontal_space = match direction {
        "right" => right,
        "left" => left,
        _ => area.width as i32 + gap,
    };
    let vertical_space = match direction {
        "bottom" => below,
        "top" => above,
        _ => area.height as i32 + gap,
    };
    let w = preferred_width.min(horizontal_space.saturating_sub(gap).max(1) as u32);
    let h = preferred_height.min(vertical_space.saturating_sub(gap).max(1) as u32);
    let (mut x, mut y) = if direction == "right" {
        (
            input.orb_rect.x + input.orb_rect.width as i32 + gap,
            input.orb_rect.y,
        )
    } else if direction == "left" {
        (input.orb_rect.x - w as i32 - gap, input.orb_rect.y)
    } else if direction == "bottom" {
        (
            input.orb_rect.x,
            input.orb_rect.y + input.orb_rect.height as i32 + gap,
        )
    } else if direction == "top" {
        (input.orb_rect.x, input.orb_rect.y - h as i32 - gap)
    } else {
        unreachable!()
    };
    x = x.clamp(area.x, area.x + area.width as i32 - w as i32);
    y = y.clamp(area.y, area.y + area.height as i32 - h as i32);
    PlacementResult {
        x,
        y,
        width: w,
        height: h,
        direction: direction.to_owned(),
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn chooses_right_then_left_and_clamps() {
        let area = Rect {
            x: 0,
            y: 0,
            width: 1920,
            height: 1080,
        };
        let p = calculate(PlacementInput {
            orb_rect: Rect {
                x: 20,
                y: 500,
                width: 96,
                height: 96,
            },
            monitor_work_area: area,
            preferred_workspace_width: 1100,
            preferred_workspace_height: 760,
            gap: 8,
        });
        assert_eq!(p.direction, "right");
        assert!(p.x >= 0 && p.y >= 0);
        let p = calculate(PlacementInput {
            orb_rect: Rect {
                x: 1800,
                y: 500,
                width: 96,
                height: 96,
            },
            monitor_work_area: area,
            preferred_workspace_width: 1100,
            preferred_workspace_height: 760,
            gap: 8,
        });
        assert_eq!(p.direction, "left");
    }

    #[test]
    fn shrinks_into_largest_available_side_without_overlapping_orb() {
        let p = calculate(PlacementInput {
            orb_rect: Rect {
                x: 912,
                y: 468,
                width: 96,
                height: 96,
            },
            monitor_work_area: Rect {
                x: 0,
                y: 0,
                width: 1920,
                height: 1080,
            },
            preferred_workspace_width: 1650,
            preferred_workspace_height: 1140,
            gap: 12,
        });
        assert_eq!(p.direction, "right");
        assert_eq!(p.x, 1020);
        assert_eq!(p.width, 900);
        assert!(p.x >= 912 + 96 + 12);
        assert!(p.x + p.width as i32 <= 1920);
    }
}
