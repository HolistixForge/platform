/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      dropShadow: {
        glowing: '0 0 2px rgba(255, 255, 255, 1)',
      },
      colors: {
        '--c-blue-6': '#141432',
        '--c-blue-61': '#161230',
        '--c-blue-62': '#1b1a43',
        '--c-blue-4': '#2c6e8a',
        '--c-blue-3': '#288eb9',
        '--c-blue-1': '#81f6ef',

        '--c-blue-gray-0': '#2b2b46',
        '--c-blue-gray-1': '#292543',
        '--c-blue-gray-2': '#1c1c39',
        '--c-blue-gray-3': '#6e678c',
        '--c-blue-gray-4': '#a998da',
        '--c-blue-gray-5': '#352c58',
        '--c-blue-gray-6': '#221c3d',
        '--c-blue-gray-7': '#352c58',
        '--c-blue-gray-8': '#2c2c47',
        '--c-blue-gray-9': '#2e2b43',

        '--c-alt-gray-1': '#535365',

        '--c-alt-blue-5': '#535365',
        '--c-alt-blue-4': '#6077c9',
        '--c-alt-blue-3': '#6563ff',
        '--c-alt-blue-2': '#52acff',
        '--c-alt-blue-1': '#60c9c9',

        '--c-unknown-3': '#dc745f',

        '--c-orange-3': '#ca922e',

        '--c-yellow-3': '#ffcc00',
        '--c-yellow-2': '#f9f871',
        '--c-yellow-1': '#f8f1cb',

        '--c-green-4': '#397833',
        '--c-green-3': '#5bc673',
        '--c-green-2': '#569047',
        '--c-green-1': '#00c897',

        '--c-white-1': '#ffffff',
        '--c-white-2': '#55556B',

        '--ca-white-8': '#C4C4C4',
        '--ca-white-9': 'rgba(255, 255, 255, 0.9)',
        '--ca-white-2': 'rgba(255, 255, 255, 0.15)',
        '--ca-white-1': 'rgba(255, 255, 255, 0.1)',

        '--c-red-5': '#923838',
        '--c-red-4': '#be0000',
        '--c-red-3': '#c31c4f',
        '--c-red-2': '#b34444',
        '--c-red-1': '#c43838',

        '--c-taupe-4': '#a14862',

        '--c-pink-7': '#935BD9',
        '--c-pink-6': '#41005a',
        '--c-pink-5': '#4b0164',
        '--c-pink-51': '#672aa4',
        '--c-pink-4': '#76318e',
        '--c-pink-41': '#742f94',
        '--c-pink-3': '#a35bbb',
        '--c-pink-2': '#d186e9',
        '--c-pink-1': '#ffb3ff',

        '--c-black-6': '#000000',
        '--c-black-5': '#111111',
        '--c-black-4': '#222222',
        '--c-black-3': '#333333',

        '--ca-black-2': 'rgba(0, 0, 0, 0.75)',
        '--ca-black-3': 'rgba(0, 0, 0, 0.65)',
        '--ca-black-4': 'rgba(0, 0, 0, 0.55)',
        '--ca-black-5': 'rgba(0, 0, 0, 0.45)',
        '--ca-black-6': 'rgba(0, 0, 0, 0.25)',
        '--ca-black-7': 'rgba(0, 0, 0, 0.17)',
        '--ca-black-8': 'rgba(0, 0, 0, 0.1)',
        '--ca-black-9': 'rgba(0, 0, 0, 0.05)',

        '--c-random-1': 'rgb(91, 145, 243)',
        '--c-random-2': 'rgb(182, 116, 150)',
        '--c-random-3': 'rgb(105, 85, 132)',
        '--c-random-4': 'rgb(248, 144, 96)',
        '--c-random-5': 'rgb(17, 69, 69)',
      },
    },
  },
  plugins: [],
};
