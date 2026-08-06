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
    let w = input.preferred_workspace_width.min(area.width);
    let h = input.preferred_workspace_height.min(area.height);
    let gap = input.gap as i32;
    let (mut x, mut y, direction) = if right >= w as i32 + gap {
        (
            input.orb_rect.x + input.orb_rect.width as i32 + gap,
            input.orb_rect.y,
            "right",
        )
    } else if left >= w as i32 + gap {
        (input.orb_rect.x - w as i32 - gap, input.orb_rect.y, "left")
    } else if below >= h as i32 + gap {
        (
            input.orb_rect.x,
            input.orb_rect.y + input.orb_rect.height as i32 + gap,
            "bottom",
        )
    } else if above >= h as i32 + gap {
        (input.orb_rect.x, input.orb_rect.y - h as i32 - gap, "top")
    } else {
        (
            input.orb_rect.x + input.orb_rect.width as i32 + gap,
            input.orb_rect.y,
            "right",
        )
    };
    x = x.clamp(area.x, area.x + area.width as i32 - w as i32);
    y = y.clamp(area.y, area.y + area.height as i32 - h as i32);
    PlacementResult {
        x,
        y,
        width: w,
        height: h,
        direction: direction.into(),
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
}
