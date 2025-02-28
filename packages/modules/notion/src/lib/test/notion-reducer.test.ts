import { NotionReducer } from '../notion-reducer';
import exampleData from './example.json';

describe('transformDatabaseResponse', () => {
  it('should correctly transform database response', () => {
    const { dbResponse, pagesResponse } = exampleData;

    const reducer = new NotionReducer();

    const result = reducer.transformDatabaseResponse(dbResponse, pagesResponse);

    console.log(JSON.stringify(result, null, 2));

    // Test basic structure
    expect(result).toHaveProperty('id');
    expect(result).toHaveProperty('title');
    expect(result).toHaveProperty('properties');
    expect(result).toHaveProperty('pages');
    expect(result).toHaveProperty('lastSync');

    // Test specific values
    expect(result.id).toBe('18f8a806-8674-803f-a0e9-ea1e2202a159');
    expect(result.title).toBe('test_db');

    // Test pages array
    expect(result.pages).toHaveLength(2);

    // Test first page
    const firstPage = result.pages[0];
    expect(firstPage.id).toBe('18f8a806-8674-80f2-a616-fa2d758923fb');
    expect(firstPage.title).toBe('création depuis notion');
    expect(firstPage.properties.Status.value).toEqual({
      id: 'e5c1fad8-0776-472d-bd76-b0aebdc8f9e4',
      name: 'Done',
      color: 'green',
    });

    // Test properties structure
    expect(result.properties).toHaveProperty('Description');
    expect(result.properties).toHaveProperty('Status');
    expect(result.properties).toHaveProperty('Priority Level');
    expect(result.properties).toHaveProperty('Name');
  });
});
