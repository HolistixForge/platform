import * as Tooltip from '@radix-ui/react-tooltip';
import { Route, Routes, useLocation } from 'react-router-dom';

import { DebugComponentKeyboardShortcut } from '@monorepo/log';
import { ApiContext } from '@monorepo/frontend-data';

import {
  AccountSettingsPage,
  EnforceUserAccountReady,
  ForgotPasswordPage,
  LoginLinkedinPage,
  LoginPage,
  SignupPage,
  SimpleMessagePage,
} from './pages/account';
import { HomePage } from './pages/home';
import { MaintenancePage } from './pages/maintenance';
import { ProjectRoot } from './pages/project/project-root';
import { ProjectAuthorizationsPage } from './pages/project/authorizations';
import { EditorPage } from './pages/project/editor/editor-page';
import { MobileBlockOverlay } from './MobileBlockOverlay';

//

import '@radix-ui/themes/styles.css';

//

export function App() {
  // return <MaintenancePage />;

  const location = useLocation();
  const hideMobileBlock = location.pathname === '/account/login-linkedin';
  return (
    <>
      <MobileBlockOverlay disabled hide={hideMobileBlock} />
      <Tooltip.Provider>
        <DebugComponentKeyboardShortcut />

        <ApiContext
          env={import.meta.env.VITE_ENVIRONMENT}
          domain={'demiurge.co'}
        >
          <EnforceUserAccountReady>
            <Routes>
              <Route path="/maintenance" element={<MaintenancePage />} />
              <Route path="/" element={<HomePage />} />
              <Route path="/p/:owner/:project_name" element={<ProjectRoot />}>
                <Route path="editor" element={<EditorPage />} />
                <Route
                  path="authorizations"
                  element={<ProjectAuthorizationsPage />}
                />

                {/* TODO_MENU
              <Route path="jupyterlabs" element={<ProjectJupyterlabsPage />} />
              */}
              </Route>

              <Route path="/account/signup" element={<SignupPage />} />
              <Route path="/account/login" element={<LoginPage />} />
              <Route
                path="/account/login-linkedin"
                element={<LoginLinkedinPage />}
              />
              <Route
                path="/account/settings"
                element={<AccountSettingsPage />}
              />
              <Route
                path="/account/forgot-password"
                element={<ForgotPasswordPage />}
              />
              <Route
                path="/account/link-failed"
                element={<SimpleMessagePage />}
              />

              <Route path="/*" element={<h2>404</h2>} />
            </Routes>
          </EnforceUserAccountReady>
        </ApiContext>
      </Tooltip.Provider>
    </>
  );
}
