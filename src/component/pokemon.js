import CatalogView from './CatalogView';
import { loadPokemon } from '../API/catalog';

function POKEList() {
  return (
    <CatalogView
      queryKey="pokemon"
      searchId="poke-search"
      placeholder="Search pokemon..."
      href={(item) => `/movie/${item.id}`}
      load={(page, search, fresh) => loadPokemon(page, search, fresh)}
    />
  );
}

export default POKEList;
