import { Dispatcher } from '@monorepo/collab-engine';
import { TEdge } from '@monorepo/core';
import { TNodeView, nodeViewDefaultStatus, TSpaceEvent } from '@monorepo/space';
import { TSd } from './build-collab';

//
//

const nodesViews: Array<Pick<TNodeView, 'id' | 'position' | 'standalone'>> = [
  {
    id: '1',
    position: { x: 377, y: -179 },
    standalone: true,
  },
  {
    id: '2',
    position: { x: 175, y: 26 },
    standalone: true,
  },
  {
    id: '3',
    position: { x: 542, y: 74 },
    standalone: true,
  },
  {
    id: '4',
    position: { x: 131, y: 214 },
    standalone: true,
  },
  {
    id: '5',
    position: { x: 612, y: 328 },
    standalone: true,
  },
  {
    id: '6',
    position: { x: 456, y: 574 },
    standalone: true,
  },
  {
    id: '7',
    position: { x: 150, y: 400 },
    standalone: true,
  },
  {
    id: 'video-1',
    position: { x: 700, y: 700 },
    standalone: true,
  },
  {
    id: 'terminal-1',
    position: { x: 700, y: 100 },
    standalone: true,
  },
];

//
//

const edges: Array<TEdge> = [
  {
    from: {
      node: '1',
      connectorName: 'outputs',
    },
    to: {
      node: '2',
      connectorName: 'inputs',
    },
    type: 'next_in_sequence',
  },

  {
    from: {
      node: '1',
      connectorName: 'outputs',
    },
    to: {
      node: '3',
      connectorName: 'inputs',
    },
    type: 'next_in_sequence',
  },

  {
    from: {
      node: '2',
      connectorName: 'outputs',
    },
    to: {
      node: '4',
      connectorName: 'inputs',
    },
    type: 'next_in_sequence',
  },

  {
    from: {
      node: '4',
      connectorName: 'outputs',
      pinName: 'pin-0',
    },
    to: {
      node: '5',
      connectorName: 'inputs',
    },
    type: 'next_in_sequence',
  },

  {
    from: {
      node: '4',
      connectorName: 'outputs',
      pinName: 'pin-1',
    },
    to: {
      node: '6',
      connectorName: 'inputs',
    },
    type: 'next_in_sequence',
  },

  {
    from: {
      node: '4',
      connectorName: 'outputs',
    },
    to: {
      node: '7',
      connectorName: 'inputs',
    },
    type: 'next_in_sequence',
  },
];

//
//
//

export const loadExampleData = (
  sd: TSd,
  dispatcher: Dispatcher<TSpaceEvent, undefined>
) => {
  sd.edges.push(edges);

  sd.graphViews.set('view-1', {
    params: {
      maxRank: 2,
      roots: ['1'],
    },
    nodeViews: nodesViews.map((nv) => ({
      ...nv,
      status: nodeViewDefaultStatus(),
    })),
    edges: [],
    connectorViews: new Map(),
    graph: {
      nodes: [],
      edges: [],
    },
  });

  sd.graphViews.set('view-2', {
    params: {
      maxRank: 2,
      roots: ['4'],
    },
    nodeViews: nodesViews.map((nv) => ({
      ...nv,
      status: nodeViewDefaultStatus(),
    })),
    edges: [],
    connectorViews: new Map(),
    graph: {
      nodes: [],
      edges: [],
    },
  });

  sd.graphViews.forEach((gv: any, viewId: string) =>
    (dispatcher as Dispatcher<TSpaceEvent, undefined>).dispatch({
      type: 'space:action',
      action: { type: 'update-graph-view' },
      viewId,
    })
  );

  // --------------------

  sd.nodes.set('1', {
    id: '1',
    type: 'python',
    data: {
      code: ['pip install matplotlib', 'pip install ipympl'].join('\n'),
      dkid: 'kernel_1_uid',
    },
    name: '',
    root: false,
    connectors: [],
  });
  sd.nodes.set('2', {
    id: '2',
    type: 'python',
    data: {
      code: [
        '%matplotlib widget\n',
        'import matplotlib.pyplot as plt\n',
        'import numpy as np\n',
        "plt.style.use('_classic_test_patch') # _mpl-gallery-nogrid\n",
        '# make a stream function:\n',
        'X, Y = np.meshgrid(np.linspace(-3, 3, 256), np.linspace(-3, 3, 256))\n',
        'Z = (1 - X/2 + X**5 + Y**3) * np.exp(-X**2 - Y**2)\n',
        '# make U and V out of the streamfunction:\n',
        'V = np.diff(Z[1:, :], axis=1)\n',
        'U = -np.diff(Z[:, 1:], axis=0)\n',
        '# plot:\n',
        'fig, ax = plt.subplots()\n',
        'ax.streamplot(X[1:, 1:], Y[1:, 1:], U, V)\n',
        'plt.show()',
      ].join(''),
      dkid: 'kernel_1_uid',
    },
    name: '',
    root: false,
    connectors: [],
  });
  sd.nodes.set('3', {
    id: '3',
    type: 'python',
    data: { code: "print('hello world !')", dkid: 'kernel_1_uid' },
    name: '',
    root: false,
    connectors: [],
  });
  sd.nodes.set('4', {
    id: '4',
    type: 'python',
    data: {
      code: [
        'from bokeh.io import output_notebook\n',
        'output_notebook()\n',
        'import numpy as np\n',
        '\n',
        'from bokeh.models import HoverTool\n',
        'from bokeh.plotting import figure, show\n',
        '\n',
        'n = 500\n',
        'x = 2 + np.random.standard_normal(n)\n',
        'y = 2 + np.random.standard_normal(n)\n',
        '\n',
        'p = figure(title="Hexbin for 500 points", match_aspect=True,\n',
        '           tools="wheel_zoom,reset", background_fill_color=\'#440154\')\n',
        'p.grid.visible = False\n',
        '\n',
        'r, bins = p.hexbin(x, y, size=0.5, hover_color="pink", hover_alpha=0.8)\n',
        '\n',
        'p.circle(x, y, color="white", size=1)\n',
        '\n',
        'p.add_tools(HoverTool(\n',
        '    tooltips=[("count", "@c"), ("(q,r)", "(@q, @r)")],\n',
        '    mode="mouse", point_policy="follow_mouse", renderers=[r]\n',
        '))\n',
        '\n',
        'show(p)',
      ].join(''),
      dkid: 'kernel_1_uid',
    },
    name: '',
    root: false,
    connectors: [],
  });
  sd.nodes.set('5', {
    id: '5',
    type: 'python',
    data: {
      code: `import sys
      sys.path.append('/home/jovyan/work')
      # Bokeh Libraries
      from bokeh.plotting import figure, show
      from bokeh.io import output_file
      from bokeh.models import ColumnDataSource, NumeralTickFormatter, HoverTool
      
      # Import the data
      from read_nba_data import three_takers
      
      # Output to file
      output_file('three_point_att_vs_pct.html',
                  title='Three-Point Attempts vs. Percentage')
      
      # Store the data in a ColumnDataSource
      three_takers_cds = ColumnDataSource(three_takers)
      
      #Specify the selection tools to be made available
      select_tools = ['box_select', 'lasso_select', 'poly_select', 'tap', 'reset']
      
      # Format the tooltip
      tooltips = [
                  ('Player', '@name'),
                  ('Three-Pointers Made', '@play3PM'),
                  ('Three-Pointers Attempted', '@play3PA'),
                  ('Three-Point Percentage', '@pct3PM{00.0%}')   
                  ]
      
      # Create the figure
      fig = figure(plot_height=400,
                      plot_width=600,
                      x_axis_label='Three-Point Shots Attempted',
                      y_axis_label='Percentage Made',
                      title='3PT Shots Attempted vs. Percentage Made (min. 100 3PA), 2017-18',
                      toolbar_location='below',
                      tools=select_tools)
      
      # Format the y-axis tick label as percentages
      fig.yaxis[0].formatter = NumeralTickFormatter(format='00.0%')
      
      # Add square representing each player
      fig.square(x='play3PA',
                  y='pct3PM',
                  source=three_takers_cds,
                  color='royalblue',
                  selection_color='deepskyblue',
                  nonselection_color='lightgray',
                  nonselection_alpha=0.3)
      
      # Add the HoverTool to the figure
      fig.add_tools(HoverTool(tooltips=tooltips))
      
      # Visualize
      show(fig)`,
      dkid: 'kernel_1_uid',
    },
    name: '',
    root: false,
    connectors: [],
  });
  sd.nodes.set('6', {
    id: '6',
    type: 'python',
    data: { code: "print('hello world !')", dkid: 'kernel_1_uid' },
    name: '',
    root: false,
    connectors: [],
  });
  sd.nodes.set('7', {
    id: '7',
    type: 'python',
    data: { code: "print('hello world !')", dkid: 'kernel_1_uid' },
    name: '',
    root: false,
    connectors: [],
  });

  // ------------------

  sd.nodes.set('video-1', {
    id: 'video-1',
    type: 'video',
    data: { youtubeId: 'VMj-3S1tku0' },
    name: '',
    root: false,
    connectors: [],
  });

  // ------------------

  sd.nodes.set('terminal-1', {
    id: 'terminal-1',
    type: 'terminal',
    data: { server_name: 'server_1', project_server_id: 1 },
    name: '',
    root: false,
    connectors: [],
  });

  // ------------------

  sd.projectServers.set(`${1}`, {
    image_id: 42,
    project_id: 1000000,
    project_server_id: 1,
    server_name: 'server1',
    ip: undefined,
    httpServices: [],
    last_watchdog_at: null,
    type: 'jupyter',
    last_activity: new Date().toISOString(),
    host_user_id: null,
    oauth: [],
    location: 'none',
    ec2_instance_state: null,
  });

  sd.jupyterServers.set('1', {
    project_server_id: 1,
    kernels: [
      {
        dkid: 'kernel_1_uid',
        kernelName: 'kernel_1',
        jkid: undefined,
        kernelType: 'python3',
      },
    ],
  });
};
