import { defaults } from "../config/defaults";

// 🔹 Pagination
const pagination = ({
  page = defaults.page,
  limit = defaults.limit,
  total,
}: {
  page: number;
  limit: number;
  total: number;
}) => {
  const totalPages = Math.ceil(total / limit);

  const pagination: any = {
    page,
    limit,
    total: total,
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
