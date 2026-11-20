import { useEffect, useRef, useState } from 'react';

function areFiltersPending(filters, query, defaultFilters) {
  return Object.keys(defaultFilters).some((key) => filters[key] !== query[key]);
}

export default function usePaginatedQuery({ defaultFilters, initialFilters, resetFilters, syncKey, fetchPage }) {
  const startingFilters = initialFilters || defaultFilters;
  const firstSync = useRef(true);
  const [filters, setFilters] = useState(startingFilters);
  const [query, setQuery] = useState({ ...startingFilters, page: 0 });
  const [pageData, setPageData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let ignore = false;

    async function loadPage() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetchPage(query);

        if (!ignore) {
          setPageData(response);
        }
      } catch (apiError) {
        if (!ignore) {
          setError(apiError);
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    loadPage();

    return () => {
      ignore = true;
    };
  }, [query, fetchPage]);

  useEffect(() => {
    if (firstSync.current) {
      firstSync.current = false;
      return;
    }

    if (syncKey === undefined) {
      return;
    }

    const nextFilters = initialFilters || defaultFilters;
    setFilters(nextFilters);
    setQuery({ ...nextFilters, page: 0 });
  }, [syncKey]);

  function handleFilterChange(event) {
    setFilters({ ...filters, [event.target.name]: event.target.value });
  }

  function handleSubmit(event) {
    event.preventDefault();
    setQuery({ ...filters, page: 0 });
  }

  function handleClearFilters() {
    const nextFilters = resetFilters || defaultFilters;
    setFilters(nextFilters);
    setQuery({ ...nextFilters, page: 0 });
  }

  function handlePageChange(nextPage) {
    setQuery({ ...query, page: nextPage });
  }

  const content = Array.isArray(pageData?.content) ? pageData.content : [];
  const currentPage = pageData?.page ?? Number(query.page) ?? 0;
  const totalPages = pageData?.totalPages ?? 0;
  const totalElements = pageData?.totalElements ?? 0;
  const hasPendingFilters = areFiltersPending(filters, query, defaultFilters);

  return {
    filters,
    query,
    pageData,
    content,
    currentPage,
    totalPages,
    totalElements,
    loading,
    error,
    hasPendingFilters,
    handleFilterChange,
    handleSubmit,
    handleClearFilters,
    handlePageChange,
  };
}
