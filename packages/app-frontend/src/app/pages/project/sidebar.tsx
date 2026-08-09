import { Sidebar, SidebarVariant, icons } from '@holistix-forge/ui-base';
import { useProject } from '@holistix-forge/frontend-data';

//

/**
 * The project's places, in one column.
 *
 * Access control is one of them again. It was here, moved to a key in the
 * header when it became organization-scoped, and that put a project-shaped
 * question in the one bar that is the same on every page — where it read as a
 * global setting rather than as somewhere you go from a project.
 *
 * It is still an organization page; what changed is only where you reach it
 * from. The header keeps the key on organization pages, which have no rail to
 * carry it.
 */
export const ProjectSidebar = ({
  active,
  variant,
}: {
  active: string;
  variant?: SidebarVariant;
}) => {
  const { organization_id } = useProject();

  return (
    <Sidebar
      active={active}
      variant={variant}
      items={[
        // TODO_MENU
        // { title: 'planet', Icon: icons.Planet },
        // { title: 'solar system', Icon: icons.SolarSystem },
        // { title: 'galaxy', Icon: icons.Galaxy },
        { title: 'project-main', Icon: icons.NodeMother, link: '../editor' },
        // Resources used to be a tab, which put a permanent tab in everyone's
        // tab bar for a page they open occasionally — and made it look like
        // one board among the boards, which it is not. It is a place in the
        // project, so it belongs where the project's places are.
        //
        // The link is relative: `..` drops the last segment, so it resolves
        // from `/p/:owner/:project/editor` and from the resources page itself.
        { title: 'resources', Icon: icons.EnterResource, link: '../resources' },
        // Absolute, unlike the two above: permissions belong to the
        // organization, not to the project, so there is no number of `..`
        // that reaches them from here.
        {
          title: 'accesses',
          Icon: icons.Key,
          link: `/org/${organization_id}/permissions`,
        },
        // { title: 'tree', Icon: icons.Tree },
        // { title: 'biome', Icon: icons.Biome },
        // { title: 'seed', Icon: icons.Seed },
        // { title: 'artefact', Icon: icons.Artefact },
        // { title: 'agora', Icon: icons.Agora },
        // { title: 'jupyterlabs', Icon: icons.Jupyter, link: '../jupyterlabs' },
      ]}
    />
  );
};
