/**
 * The jsdom globals react-router needs are in the workspace preset
 * (jest.setup.js) — they are an environment gap, not this package's business.
 * What is this package's business is jest-dom, so every spec here gets the DOM
 * matchers without importing them one by one.
 */
import '@testing-library/jest-dom';
