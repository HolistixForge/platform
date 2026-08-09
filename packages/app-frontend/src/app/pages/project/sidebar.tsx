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
        // Resources used to be a tab, which put a permanent tab in everyone's
        // tab bar for a page they open occasionally — and made it look like
        // one board among the boards, which it is not. It is a place in the
        // project, so it belongs where the project's places are.
        //
        // The link is relative: `..` drops the last segment, so it resolves
        // from `/p/:owner/:project/editor` and from the resources page itself.
        { title: 'resources', Icon: icons.EnterResource, link: '../resources' },
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
