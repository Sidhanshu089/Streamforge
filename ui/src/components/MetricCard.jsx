import React from "react";


export default function MetricCard({
  title,
  value,
  subtitle,
  trend,
  trendType = "neutral",
}) {

  return (
    <div className="metric-card">

      {/* =====================================================
          HEADER
      ====================================================== */}

      <div className="metric-card-header">

        <span className="metric-title">
          {title}
        </span>

        <span className="metric-menu">
          •••
        </span>

      </div>


      {/* =====================================================
          MAIN VALUE
      ====================================================== */}

      <div className="metric-value">
        {value}
      </div>


      {/* =====================================================
          FOOTER
      ====================================================== */}

      <div className="metric-card-footer">

        {subtitle && (
          <span className="metric-subtitle">
            {subtitle}
          </span>
        )}


        {trend && (
          <span
            className={`metric-trend ${trendType}`}
          >
            {trend}
          </span>
        )}

      </div>

    </div>
  );
}