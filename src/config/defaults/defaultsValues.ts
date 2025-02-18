const defaults: {
  page: number;
  limit: number;
  sortType: string;
  sortBy: string;
  search: string;
} = {
  page: 1,
  limit: 10,
  sortType: "desc",
  sortBy: "updatedAt",
  search: "",
};

export default Object.freeze(defaults);
