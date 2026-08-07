import { Sidebar, SidebarVariant, icons } from '@holistix-forge/ui-base';

//

export const ProjectSidebar = ({
  active,
  variant,
}: {
  active: string;
  variant?: SidebarVariant;
}) => {
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
        // { title: 'tree', Icon: icons.Tree },
        // { title: 'biome', Icon: icons.Biome },
        // { title: 'seed', Icon: icons.Seed },
        // { title: 'artefact', Icon: icons.Artefact },
        // { title: 'agora', Icon: icons.Agora },
        // NOTE: Authorizations moved to org-level at /org/:organization_id/permissions
        // { title: 'jupyterlabs', Icon: icons.Jupyter, link: '../jupyterlabs' },
      ]}
    />
  );
};
