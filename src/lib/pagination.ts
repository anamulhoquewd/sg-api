import { defaults } from "../config/defaults";

// Interface of props
interface PaginationProps {
  page: number;
  limit: number;
  total: number;
}
interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  nextPage?: number;
  prevPage?: number;
}

// Pagination
const pagination = ({
  page = defaults.page,
  limit = defaults.limit,
  total,
}: PaginationProps): Pagination => {
  const totalPages = Math.ceil(total / limit);

  const pagination: Pagination = {
    page,
    limit,
    total,
    totalPages,
  };

  if (page < totalPages) {
    pagination.nextPage = page + 1;
  }
  if (page > 1) {
    pagination.prevPage = page - 1;
  }

  return pagination;
};

export default pagination;
