import { DebugComponentKeyboardShortcut } from '@monorepo/log';
import { Route, Routes } from 'react-router-dom';
import { ApiContext } from '@monorepo/demiurge-data';
import {
  AccountSettingsPage,
  EnforceUserAccountReady,
  ForgotPasswordPage,
  LoginPage,
  SignupPage,
  SimpleMessagePage,
} from './pages/account';
import { HomePage } from './pages/home';
import { ProjectRoot } from './pages/project/project-root';
import { ProjectAuthorizationsPage } from './pages/project/authorizations';
import { EditorPage } from './pages/project/editor/editor-page';
import { ResourcePage } from './pages/project/editor/resources-page';
import * as Tooltip from '@radix-ui/react-tooltip';
//
//
import '@radix-ui/themes/styles.css';

//

//
//

export function App() {
  return (
    <>
      <Tooltip.Provider>
        <DebugComponentKeyboardShortcut />

        <ApiContext env={'dev-001'} domain={'demiurge.co'}>
          <EnforceUserAccountReady>
            <Routes>
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
