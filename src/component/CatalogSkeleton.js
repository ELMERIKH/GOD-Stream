import React from "react";

export function LoaderMark({ small = false }) {
  return (
    <span className={small ? "loader-mark loader-mark--sm" : "loader-mark"} aria-hidden="true">
      <span className="loader-mark__glow" />
      <span className="loader-mark__ring" />
      <span className="loader-mark__ring loader-mark__ring--inner" />
      <svg viewBox="0 0 24 24" focusable="false">
        <path d="M8 5.5v13l11-6.5-11-6.5z" />
      </svg>
    </span>
  );
}

function ShimmerCard() {
  return (
    <div className="catalog-skeleton__card">
      <div className="catalog-skeleton__poster" />
      <div className="catalog-skeleton__bar" />
      <div className="catalog-skeleton__bar catalog-skeleton__bar--short" />
    </div>
  );
}

function CatalogSkeleton({ variant = "grid", label }) {
  if (variant === "watch" || variant === "reader") {
    const reader = variant === "reader";
    return (
      <div className={`watch-page catalog-skeleton catalog-skeleton--${variant}`} role="status" aria-live="polite" aria-busy="true">
        <p className="catalog-skeleton__status">
          <LoaderMark />
          <span>{label || (reader ? "Opening the reader" : "Opening title")}</span>
        </p>
        <div className="catalog-skeleton__stage">
          {reader ? (
            <div className="catalog-skeleton__pages">
              <div className="catalog-skeleton__page" />
              <div className="catalog-skeleton__page" />
              <div className="catalog-skeleton__page catalog-skeleton__page--short" />
            </div>
          ) : (
            <div className="catalog-skeleton__player">
              <LoaderMark />
            </div>
          )}
          <div className="catalog-skeleton__pills">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="catalog-skeleton__pill" />
            ))}
          </div>
        </div>
        <div className="catalog-skeleton__meta">
          <div className="catalog-skeleton__poster" />
          <div className="catalog-skeleton__copy">
            <div className="catalog-skeleton__bar catalog-skeleton__bar--pill" />
            <div className="catalog-skeleton__bar catalog-skeleton__bar--title" />
            <div className="catalog-skeleton__bar" />
            <div className="catalog-skeleton__bar" />
            <div className="catalog-skeleton__bar catalog-skeleton__bar--short" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="catalog-skeleton" role="status" aria-live="polite" aria-busy="true">
      <p className="catalog-skeleton__status">
        <LoaderMark small />
        <span>{label || "Loading titles"}</span>
      </p>
      <div className="catalog-skeleton__grid">
        {Array.from({ length: 8 }, (_, index) => (
          <ShimmerCard key={index} />
        ))}
      </div>
    </div>
  );
}

export default CatalogSkeleton;
