import { quadrantLabels } from "../../utils/quadrant";
export function QuadrantBackground() { return <div className="quadrants" aria-hidden="true">
  <div className="quadrant q1"><span>Q1 · {quadrantLabels.q1}</span></div><div className="quadrant q2"><span>Q2 · {quadrantLabels.q2}</span></div>
  <div className="quadrant q3"><span>Q3 · {quadrantLabels.q3}</span></div><div className="quadrant q4"><span>Q4 · {quadrantLabels.q4}</span></div>
  <i className="axis vertical"/><i className="axis horizontal"/>
  </div>; }

