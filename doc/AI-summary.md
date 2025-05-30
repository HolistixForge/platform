# AI tool context notes

My app architecture is as follow, I have a collaborative environment where shared data are maintained on backend and browsers can send events to the backend. the backend process the events and update the shared data that are pushed to all browsers.

## sequence of events

here is the context, I have an app with collaboration features.

users browsers shared what is called "shared data", usually updated and pushed from the backend.

The app mutation are handle by event sent to the backend, processed through reducer and update to shared data are pushed to clients

Now some events are rapidly firing, like when someone move a node on the collaborative whiteboard so that node movement is viewable by all users.

that need to introduce a concept of events Sequence, to be able to track sequence event order and termination, and to introduce error handling mecanics when error occured in the middle of a sequence.

inside this sequence logic reside another concept of local reducer to immediately apply changes in the browser of the user doing action, to have no latency in the user experience.

to do that, browser in fact work with a copy of the shared data, where a LocalOverider overwrite some properties accordingly to the localReducer function define in the active sequence of events.

Now, analyse the files i give to yiou and have a look where all this logics reside. Then i will point you something in the behaviour that we will need to fix.
