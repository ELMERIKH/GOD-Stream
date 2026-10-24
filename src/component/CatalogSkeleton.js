import React from 'react';

function CatalogSkeleton() {
  return (
    <div className="catalog-skeleton" role="status" aria-live="polite" aria-busy="true">
      <p>Loading titles</p>
      <div className="catalog-skeleton__grid">
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} className="catalog-skeleton__card" />
        ))}
      </div>
    </div>
  );
}

export default CatalogSkeleton;
