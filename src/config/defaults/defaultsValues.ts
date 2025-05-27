// Default values interface
interface DefaultsValues {
  page: number;
  limit: number;
  sortType: string;
  sortBy: string;
  search: string;
}

// Default values
const defaults: DefaultsValues = {
  page: 1,
  limit: 10,
  sortType: "desc",
  sortBy: "updatedAt",
  search: "",
};

export default Object.freeze(defaults);
