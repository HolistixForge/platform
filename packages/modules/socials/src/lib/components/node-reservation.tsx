import React, { useCallback } from 'react';

import { TGraphNode } from '@holistix-forge/core-graph';
import { useQueryUser } from '@holistix-forge/frontend-data';
import { UserAvatar, UserUsername } from '@holistix-forge/ui-base';
import { TG_User } from '@holistix-forge/types';
import { useAwarenessUserList } from '@holistix-forge/collab/frontend';
import { useDispatcher } from '@holistix-forge/reducers/frontend';
import {
  NodeHeader,
  useNodeContext,
  useNodeHeaderButtons,
} from '@holistix-forge/space/frontend';

import { TEventSocials } from '../socials-events';

import './node-id-card.scss';

//
//

interface IDCardProps {
  user: TG_User;
  color: string;
  lanyard?: boolean;
}

const ReservationCard: React.FC<IDCardProps> = ({ user, color, lanyard }) => {
  return (
    <div className="id-card-container">
      <IDCardSvg lanyard={lanyard} />
      <div className="id-card">
        <div className="photo-section">
          <UserAvatar {...user} />
        </div>
        <div className="info-section">
          <UserUsername
            {...user}
            color={color}
            ellipsis={false}
            style={{ textAlign: 'center' }}
          />
          <span className="reservation-label">RESERVATION</span>
        </div>
      </div>
    </div>
  );
};

//

export const NodeReservation = ({ node }: { node: TGraphNode }) => {
  const userId = node.data?.userId as string;

  const { data: user } = useQueryUser(userId);

  const users = useAwarenessUserList();
  const color = user
    ? users.find((u) => u.username === user.username)?.color ||
      'var(--c-gray-9)'
    : 'var(--c-gray-9)';

  const { id, selected, open, isOpened } = useNodeContext();

  const dispatcher = useDispatcher<TEventSocials>();

  const handleDelete = useCallback(async () => {
    await dispatcher.dispatch({
      type: 'socials:delete-reservation',
      nodeId: id,
    });
  }, [dispatcher, id]);

  const buttons = useNodeHeaderButtons(
    {
      onDelete: handleDelete,
    },
    ['filterOut']
  );

  if (!user) return null;

  return (
    <div className={`common-node node-id-card node-reservation`}>
      <NodeHeader
        nodeType="id-card"
        buttons={buttons}
        visible={selected}
        id={id}
        open={open}
        isOpened={isOpened}
      />
      <ReservationCard user={user} color={color} lanyard={selected} />
    </div>
  );
};

//

const dropShadowColor = 'rgba(0, 0, 0, 0.3)';
const cardColor = 'rgba(255,255,255,0.1)';
const lanyardColor = '#a35bbb';
const lanyardColor2 = '#d186e9';

export const IDCardSvg = ({ lanyard }: { lanyard?: boolean }) => {
  const lanyardDisplay = lanyard ? 'block' : 'none';
  const lanyardOpacity = lanyard ? 1 : 0;
  const lanyardTransition = 'opacity 0.3s ease-in-out';

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 173.623 450.21399"
      style={{
        width: '100%',
        position: 'absolute',
        top: '-239px',
        left: 0,
      }}
    >
      <defs id="defs631">
        <linearGradient
          id="linearGradient1464"
          x1="152.09981"
          y1="76.11219"
          x2="172.09241"
          y2="1.9650752e-08"
          gradientUnits="userSpaceOnUse"
        >
          <stop
            style={{ stopColor: lanyardColor, stopOpacity: 1 }}
            offset="0"
            id="stop1668"
          />
          <stop
            style={{ stopColor: lanyardColor, stopOpacity: 0 }}
            offset="1"
            id="stop1670"
          />
        </linearGradient>
        <linearGradient
          id="linearGradient1666"
          x1="135.20575"
          y1="77.690605"
          x2="115.13454"
          y2="-0.52606845"
          gradientUnits="userSpaceOnUse"
        >
          <stop
            style={{ stopColor: lanyardColor2, stopOpacity: 1 }}
            offset="0"
            id="stop1668"
          />
          <stop
            style={{ stopColor: lanyardColor2, stopOpacity: 0 }}
            offset="1"
            id="stop1670"
          />
        </linearGradient>
        <linearGradient
          id="linearGradient1674"
          x1="199.93576"
          y1="192.83823"
          x2="199.103"
          y2="2.031641"
          gradientUnits="userSpaceOnUse"
        >
          <stop
            style={{ stopColor: dropShadowColor, stopOpacity: 1 }}
            offset="0"
            id="stop1458"
          />
          <stop
            style={{ stopColor: dropShadowColor, stopOpacity: 0 }}
            offset="1"
            id="stop1460"
          />
        </linearGradient>
      </defs>

      <g id="Objects" transform="translate(-58.801)">
        <g id="g553">
          <path
            style={{
              fill: 'url(#linearGradient1674)',
              display: lanyardDisplay,
              opacity: lanyardOpacity,
              transition: lanyardTransition,
            }}
            d="m 158.272,174.408 c 0.338,-9.03 -3.13,-23.606 -4.783,-30.213 h 0.963 v -1.598 h 0.998 V 141.2 h 4.997 c 6.341,0 11.5,-5.426 11.5,-12.095 0,-5.504 -3.516,-10.153 -8.307,-11.613 L 192.5,0 H 167.742 L 149.909,72.811 131.75,0 h -24.758 l 29.187,117.501 c -4.771,1.473 -8.269,6.113 -8.269,11.604 0,6.668 5.157,12.095 11.498,12.095 h 4.264 v 1.397 h 0.999 v 1.598 h 1.288 c -0.879,2.398 -2.112,5.949 -3.293,9.973 h -4.335 c -1.895,0 -3.437,1.439 -3.638,3.281 -0.123,0.367 -0.205,0.754 -0.205,1.163 0,2.03 1.646,3.676 3.677,3.676 h 2.416 c -0.914,4.23 -1.523,8.48 -1.444,12.121 -0.0389,15.43433 19.44131,15.08165 19.135,-0.001 z m -14.714,-4.046 c 0.543,-4.512 1.679,-7.17 2.831,-8.739 1.176,-0.956 2.128,-0.956 2.128,-0.956 4.435,-0.285 6.895,7.535 6.667,13.741 h -11.676 c -0.129,-1.183 -0.134,-2.514 0.05,-4.046 z m -4.15,-33.156 c -4.139,0 -7.505,-3.635 -7.505,-8.102 0,-3.614 2.202,-6.681 5.233,-7.723 l 0.374,1.515 h 0.039 24.72 0.039 l 0.377,-1.529 c 3.05,1.03 5.27,4.109 5.27,7.737 0,4.467 -3.367,8.102 -7.506,8.102 h -4.997 v -2.995 h -1.896 v -1.598 h -7.987 v 1.598 h -1.896 v 2.995 z"
            id="lanyard-shadow"
          />
          <path
            style={{ fill: 'url(#linearGradient1674)' }}
            d="m 229.229,174.408 h -70.957 l -19.135,0.001 H 69.496 c -1.764,0 -3.933007,1.5928 -3.195,3.195 116.73022,253.419 0.03119,179.65439 0,269.416 -6.14e-4,1.766 1.431,3.194 3.195,3.194 H 229.23 c 1.764,0 3.194,-1.429 3.194,-3.194 V 177.603 c 0,-1.765 -1.43,-3.195 -3.195,-3.195 z m -74.245,11.318 c 0,2.83 -2.295,5.125 -5.125,5.125 -2.83,0 -5.124,-2.295 -5.124,-5.125 0,-0.388 0.051,-0.762 0.133,-1.124 2.184,0.775 5.786,1.312 9.472,-1.316 0.397,0.728 0.644,1.551 0.644,2.44 z m 0.2,-11.318 h -11.676 z m -6.986,6.492 c 0.524,-0.181 1.077,-0.299 1.662,-0.299 0.605,0 1.176,0.123 1.715,0.316 -1.167,0.264 -2.318,0.257 -3.377,-0.017 z m 34.359,6.173 h 18.169 c 1.626,0 2.945,1.319 2.945,2.945 0,0.394 -0.081,0.768 -0.221,1.111 -0.035,0.085 -0.082,0.164 -0.125,0.245 -0.04,0.077 -0.077,0.155 -0.123,0.227 -0.048,0.075 -0.104,0.143 -0.158,0.213 -0.055,0.071 -0.109,0.142 -0.17,0.206 -0.057,0.062 -0.119,0.119 -0.182,0.175 -0.071,0.064 -0.144,0.126 -0.22,0.182 -0.063,0.047 -0.128,0.092 -0.196,0.134 -0.088,0.055 -0.18,0.103 -0.273,0.148 -0.066,0.032 -0.131,0.065 -0.2,0.092 -0.11,0.044 -0.225,0.076 -0.341,0.106 -0.06,0.016 -0.117,0.036 -0.179,0.048 -0.181,0.035 -0.366,0.056 -0.557,0.056 h -18.169 c -0.191,0 -0.376,-0.021 -0.557,-0.056 -0.062,-0.012 -0.121,-0.033 -0.182,-0.048 -0.115,-0.03 -0.229,-0.062 -0.337,-0.105 -0.07,-0.028 -0.136,-0.062 -0.204,-0.094 -0.092,-0.044 -0.182,-0.092 -0.268,-0.146 -0.069,-0.042 -0.135,-0.089 -0.2,-0.137 -0.075,-0.056 -0.146,-0.115 -0.215,-0.177 -0.064,-0.058 -0.127,-0.116 -0.187,-0.18 -0.059,-0.063 -0.111,-0.131 -0.164,-0.2 -0.056,-0.072 -0.114,-0.143 -0.163,-0.22 -0.044,-0.068 -0.078,-0.142 -0.116,-0.213 -0.122,-0.231 -0.222,-0.475 -0.28,-0.736 v 0 c -0.045,-0.204 -0.072,-0.415 -0.072,-0.632 0,-1.625 1.319,-2.944 2.945,-2.944 z m -83.66,0 h 18.169 c 1.627,0 2.945,1.319 2.945,2.945 0,0.218 -0.027,0.429 -0.072,0.633 v -0.001 c -0.059,0.267 -0.162,0.515 -0.287,0.749 -0.036,0.066 -0.067,0.135 -0.108,0.199 -0.05,0.079 -0.11,0.152 -0.168,0.226 -0.051,0.066 -0.103,0.132 -0.16,0.194 -0.06,0.064 -0.124,0.124 -0.189,0.183 -0.068,0.062 -0.139,0.12 -0.212,0.175 -0.065,0.049 -0.132,0.096 -0.202,0.139 -0.086,0.054 -0.176,0.101 -0.267,0.145 -0.067,0.033 -0.134,0.066 -0.204,0.094 -0.109,0.043 -0.223,0.075 -0.338,0.105 -0.061,0.016 -0.119,0.037 -0.182,0.048 -0.181,0.035 -0.366,0.056 -0.557,0.056 H 98.897 c -0.191,0 -0.377,-0.021 -0.557,-0.056 -0.061,-0.012 -0.12,-0.033 -0.18,-0.048 -0.115,-0.03 -0.23,-0.062 -0.339,-0.105 -0.069,-0.027 -0.135,-0.061 -0.202,-0.093 -0.093,-0.046 -0.184,-0.093 -0.271,-0.148 -0.068,-0.042 -0.133,-0.088 -0.198,-0.136 -0.076,-0.056 -0.148,-0.117 -0.218,-0.18 -0.063,-0.057 -0.126,-0.115 -0.184,-0.177 -0.06,-0.064 -0.113,-0.133 -0.167,-0.203 -0.055,-0.071 -0.112,-0.141 -0.161,-0.217 -0.044,-0.069 -0.079,-0.144 -0.118,-0.216 -0.12,-0.229 -0.22,-0.47 -0.277,-0.728 -0.046,-0.206 -0.074,-0.418 -0.074,-0.638 0,-1.626 1.319,-2.945 2.946,-2.945 z"
            id="card-shadow"
          />
          <g id="g551">
            <g id="g269">
              <g id="card">
                <path
                  style={{ fill: cardColor }}
                  d="M 221.729,166.908 H 61.996 c -1.764,0 -3.195,1.431 -3.195,3.195 V 439.52 c 0,1.766 1.431,3.194 3.195,3.194 H 221.73 c 1.764,0 3.194,-1.429 3.194,-3.194 V 170.103 c 0,-1.765 -1.43,-3.195 -3.195,-3.195 z M 109.566,185.463 H 91.397 c -1.627,0 -2.946,-1.318 -2.946,-2.945 0,-1.626 1.319,-2.945 2.946,-2.945 h 18.169 c 1.627,0 2.945,1.319 2.945,2.945 0.001,1.627 -1.318,2.945 -2.945,2.945 z m 32.793,-2.112 c -2.83,0 -5.124,-2.295 -5.124,-5.125 0,-2.83 2.295,-5.124 5.124,-5.124 2.83,0 5.125,2.294 5.125,5.124 0,2.83 -2.295,5.125 -5.125,5.125 z m 50.868,2.112 h -18.169 c -1.626,0 -2.945,-1.318 -2.945,-2.945 0,-1.626 1.319,-2.945 2.945,-2.945 h 18.169 c 1.626,0 2.945,1.319 2.945,2.945 0,1.627 -1.32,2.945 -2.945,2.945 z"
                  id="path229"
                />
                <path
                  style={{ fill: '#daebf4' }}
                  d="M 210.033,193.799 H 73.691 c -1.506,0 -2.727,0.885 -2.727,1.977 v 2.248 c 0,-1.092 1.22,-1.977 2.727,-1.977 h 136.342 c 1.507,0 2.727,0.884 2.727,1.977 v -2.248 c 0,-1.092 -1.22,-1.977 -2.727,-1.977 z"
                  id="path231"
                />
                <path
                  style={{ fill: '#daebf4' }}
                  d="M 109.566,185.463 H 91.397 c -1.409,0 -2.584,-0.991 -2.874,-2.313 -0.044,0.204 -0.072,0.415 -0.072,0.632 0,1.627 1.319,2.945 2.946,2.945 h 18.169 c 1.627,0 2.945,-1.319 2.945,-2.945 0,-0.218 -0.028,-0.428 -0.072,-0.632 -0.29,1.322 -1.464,2.313 -2.873,2.313 z"
                  id="path233"
                />
                <path
                  style={{ fill: '#daebf4' }}
                  d="m 193.227,185.463 h -18.169 c -1.408,0 -2.583,-0.991 -2.873,-2.313 -0.045,0.204 -0.072,0.415 -0.072,0.632 0,1.627 1.319,2.945 2.945,2.945 h 18.169 c 1.626,0 2.945,-1.319 2.945,-2.945 0,-0.218 -0.027,-0.428 -0.071,-0.632 -0.291,1.322 -1.465,2.313 -2.874,2.313 z"
                  id="path235"
                />
              </g>
              <g
                id="lanyard"
                style={{
                  display: lanyardDisplay,
                  opacity: lanyardOpacity,
                  transition: lanyardTransition,
                }}
              >
                <polygon
                  style={{ fill: 'url(#linearGradient1666)', fillOpacity: 1 }}
                  points="154.769,115.396 126.292,0 101.534,0 130.01,115.396 "
                  id="polygon239"
                />
                <g id="lanyard-clip">
                  <g id="hook">
                    <g id="g245">
                      <path
                        style={{ fill: '#bdbdbc' }}
                        d="m 144.095,133.5 h -4.42 c 0,0 -14.654,36.172 -4.419,42.587 0,0 6.554,4.503 12.887,-1.365 6.334,-5.869 -3.238,-37.947 -4.048,-41.222 z m 0.725,40.535 c -5.191,2.443 -11.165,0.021 -9.975,-9.874 1.323,-11.001 6.172,-10.993 6.172,-10.993 6.843,-0.441 8.994,18.423 3.803,20.867 z"
                        id="path241"
                      />
                      <path
                        style={{ fill: '#dbdbdb' }}
                        d="m 145.191,133.5 h -3.994 c 0,0 -13.244,35.274 -3.993,41.531 0,0 5.923,4.392 11.647,-1.332 5.724,-5.723 -2.928,-37.005 -3.66,-40.199 z m 0.842,39.236 c -5.191,2.443 -11.165,0.023 -9.975,-9.874 1.324,-11 6.172,-10.994 6.172,-10.994 6.844,-0.438 8.995,18.425 3.803,20.868 z"
                        id="path243"
                      />
                    </g>
                    <g id="g251">
                      <path
                        style={{ fill: '#bdbdbc' }}
                        d="m 135.715,147.444 c -0.037,-10e-4 -0.072,-0.011 -0.111,-0.011 h -4.939 c -2.031,0 -3.677,1.646 -3.677,3.677 0,2.03 1.646,3.676 3.677,3.676 h 3.394 c 0.427,-2.718 1.146,-5.522 1.656,-7.342 z"
                        id="path247"
                      />
                      <path
                        style={{ fill: '#dbdbdb' }}
                        d="m 135.881,146.679 c -0.037,-0.001 -0.072,-0.011 -0.11,-0.011 h -4.939 c -2.031,0 -3.678,1.647 -3.678,3.678 0,2.03 1.647,3.676 3.678,3.676 h 3.393 c 0.428,-2.72 1.145,-5.524 1.656,-7.343 z"
                        id="path249"
                      />
                    </g>
                  </g>
                  <path
                    style={{ fill: '#bdbdbc' }}
                    d="m 152.949,133.699 h -21.041 c -6.341,0 -11.498,-5.426 -11.498,-12.095 0,-6.67 5.157,-12.098 11.498,-12.098 h 21.041 c 6.341,0 11.499,5.427 11.499,12.098 0,6.669 -5.158,12.095 -11.499,12.095 z m -21.041,-20.2 c -4.139,0 -7.505,3.636 -7.505,8.105 0,4.467 3.366,8.102 7.505,8.102 h 21.041 c 4.139,0 7.506,-3.635 7.506,-8.102 0,-4.469 -3.367,-8.105 -7.506,-8.105 z"
                    id="path255"
                  />
                  <rect
                    x="138.069"
                    y="125.114"
                    style={{ fill: '#bdbdbc' }}
                    width="7.987"
                    height="3.194"
                    id="rect257"
                  />
                  <rect
                    x="137.17101"
                    y="133.5"
                    style={{ fill: '#bdbdbc' }}
                    width="9.783"
                    height="3.194"
                    id="rect259"
                  />
                  <rect
                    x="136.172"
                    y="126.711"
                    style={{ fill: '#dbdbdb' }}
                    width="11.78"
                    height="8.3850002"
                    id="rect261"
                  />
                </g>
                <polygon
                  style={{ fill: 'url(#linearGradient1464)', fillOpacity: 1 }}
                  points="154.808,115.396 183.285,0 158.527,0 130.049,115.396 "
                  id="polygon265"
                />
              </g>
            </g>
          </g>
        </g>
      </g>
    </svg>
  );
};
