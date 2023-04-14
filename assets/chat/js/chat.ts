/* eslint-disable @typescript-eslint/no-empty-function */
import 'whatwg-fetch';
import $ from 'jquery';
import { debounce } from 'throttle-debounce';
import moment from 'moment';
import { KEYCODES, DATE_FORMATS, isKeyCode } from './const';
import { Notification } from './notification';
import EventEmitter from './emitter';
import ChatSource from './source';
import ChatUser from './user';
import {
  MessageBuilder,
  MessageTypes,
  ChatMessage,
  checkIfPinWasDismissed,
  ChatUserMessage,
  PinnedMessage,
  ChatUIMessage,
} from './messages';
import {
  ChatMenu,
  ChatUserMenu,
  ChatWhisperUsers,
  ChatEmoteMenu,
  ChatEmoteTooltip,
  ChatSettingsMenu,
  ChatUserInfoMenu,
} from './menus';
import {
  ChatConfig,
  ChatWebsocketTypes,
  ChatWhisper,
  WebsiteApiTypes,
} from './types';
import ChatAutoComplete from './autocomplete';
import ChatInputHistory from './history';
import ChatUserFocus from './focus';
import ChatStore from './store';
import Settings from './settings';
import ChatWindow from './window';
import { ChatPoll, parseQuestionAndTime } from './poll';
import { isMuteActive, MutedTimer } from './mutedtimer';
import EmoteService from './emotes';
import UserFeatures from './features';
import makeSafeForRegex from './regex';
import { HashLinkConverter, MISSING_ARG_ERROR } from './hashlinkconverter';
import ChatEmoteMessage from './messages/ChatEmoteMessage';

const regexslashcmd = /^\/([a-z0-9]+)[\s]?/i;
const regextime = /(\d+(?:\.\d*)?)([a-z]+)?/gi;
const nickmessageregex = /(?=@?)(\w{3,20})/g;
const nickregex = /^[a-zA-Z0-9_]{3,20}$/;
const nsfwnsflregex = /\b(?:NSFL|NSFW)\b/i;
const nsfwregex = /\b(?:NSFW)\b/i;
const nsflregex = /\b(?:NSFL)\b/i;
const tagcolors = [
  'green',
  'yellow',
  'orange',
  'red',
  'purple',
  'blue',
  'sky',
  'lime',
  'pink',
  'black',
];
const errorstrings = new Map([
  ['unknown', 'Unknown error, this usually indicates an internal problem :('],
  ['nopermission', 'You do not have the required permissions to use that'],
  ['protocolerror', 'Invalid or badly formatted'],
  ['needlogin', 'You have to be logged in to use that'],
  ['invalidmsg', 'The message was invalid'],
  ['throttled', 'Throttled! You were trying to send messages too fast'],
  ['duplicate', 'The message is identical to the last one you sent'],
  ['submode', 'The channel is currently in subscriber only mode'],
  ['needbanreason', 'Providing a reason for the ban is mandatory'],
  ['privmsgbanned', 'Cannot send private messages while banned'],
  ['requiresocket', 'This chat requires WebSockets'],
  ['toomanyconnections', 'Only 5 concurrent connections allowed'],
  ['socketerror', 'Error contacting server'],
  [
    'privmsgaccounttooyoung',
    'Your account is too recent to send private messages',
  ],
  ['notfound', 'The user was not found'],
  ['notconnected', 'You have to be connected to use that'],
  ['activepoll', 'Poll already started.'],
  ['noactivepoll', 'No poll started.'],
  ['alreadyvoted', 'You have already voted!'],
]);
const hintstrings = new Map([
  [
    'slashhelp',
    'Type in /help for a list of more commands that do advanced things, like modify your scroll-back size.',
  ],
  [
    'tabcompletion',
    'Use the tab key to auto-complete names and emotes (for user only completion prepend a @ or hold shift).',
  ],
  [
    'hoveremotes',
    'Hovering your cursor over an emote will show you the emote code.',
  ],
  ['highlight', 'Chat messages containing your username will be highlighted.'],
  ['notify', 'Use /msg <nick> to send a private message to someone.'],
  [
    'ignoreuser',
    'Use /ignore <nick> to hide messages from pesky chatters. You can even ignore multiple users at once - /ignore <nick_1> ... <nick_n>!',
  ],
  ['mutespermanent', "Mutes are never persistent, don't worry it will pass!"],
  [
    'tagshint',
    `Use the /tag <nick> [<color> <note>] to tag users you like. There are preset colors to choose from ${tagcolors.join(
      ', '
    )}.`,
  ],
  [
    'bigscreen',
    `Bigscreen! Did you know you can have the chat on the left or right side of the stream by clicking the swap icon in the top left?`,
  ],
  [
    'danisold',
    'Destiny is an Amazon Associate. He earns a commission on qualifying purchases of any product on Amazon linked in Destiny.gg chat.',
  ],
]);
const settingsdefault = new Map<string, unknown>([
  ['schemaversion', 2],
  ['showtime', false],
  ['hideflairicons', false],
  ['profilesettings', false],
  ['timestampformat', 'HH:mm'],
  ['maxlines', 250],
  ['notificationwhisper', false],
  ['notificationhighlight', false],
  ['highlight', true], // todo rename this to `highlightself` or something
  ['customhighlight', []],
  ['highlightnicks', []],
  ['taggednicks', []],
  ['taggednotes', []],
  ['showremoved', 0], // 0 = false (removes), 1 = true (censor), 2 = do nothing
  ['showhispersinchat', false],
  ['ignorenicks', []],
  ['focusmentioned', false],
  ['notificationtimeout', true],
  ['ignorementions', false],
  ['autocompletehelper', true],
  ['taggedvisibility', false],
  ['hidensfw', false],
  ['hidensfl', false],
  ['fontscale', 'auto'],
  ['censorbadwords', false],
]);
const commandsinfo = new Map([
  [
    'help',
    {
      desc: 'List all chat commands.',
    },
  ],
  [
    'emotes',
    {
      desc: 'Return all emotes in text form.',
    },
  ],
  [
    'me',
    {
      desc: 'Send an action message in italics.',
    },
  ],
  [
    'message',
    {
      desc: 'Send a whisper to <nick>.',
      alias: ['msg', 'whisper', 'w', 'tell', 't', 'notify'],
    },
  ],
  [
    'ignore',
    {
      desc: 'Stop showing messages from <nick>.',
    },
  ],
  [
    'unignore',
    {
      desc: 'Remove <nick> from your ignore list.',
    },
  ],
  [
    'unignoreall',
    {
      desc: 'Remove all users from your ignore list.',
    },
  ],
  [
    'highlight',
    {
      desc: 'Highlight messages from <nick> for easier visibility.',
    },
  ],
  [
    'unhighlight',
    {
      desc: 'Unhighlight <nick>.',
    },
  ],
  [
    'maxlines',
    {
      desc: 'Set the maximum number of <lines> the chat will store.',
    },
  ],
  [
    'mute',
    {
      desc: 'Stop <nick> from sending messages.',
      admin: true,
    },
  ],
  [
    'unmute',
    {
      desc: 'Unmute <nick>.',
      admin: true,
    },
  ],
  [
    'subonly',
    {
      desc: 'Turn the subscribers-only chat mode <on> or <off>.',
      admin: true,
    },
  ],
  [
    'ban',
    {
      desc: 'Stop <nick> from connecting to the chat.',
      admin: true,
    },
  ],
  [
    'unban',
    {
      desc: 'Unban <nick>.',
      admin: true,
    },
  ],
  [
    'baninfo',
    {
      desc: 'Check your ban status.',
    },
  ],
  [
    'timestampformat',
    {
      desc: 'Set the time format of the chat.',
    },
  ],
  [
    'tag',
    {
      desc: "Mark <nick>'s messages.",
    },
  ],
  [
    'untag',
    {
      desc: 'Untags <nick>.',
    },
  ],
  [
    'embed',
    {
      desc: 'Embed a video to bigscreen.',
      alias: ['e'],
    },
  ],
  [
    'postembed',
    {
      desc: 'Post a video embed in chat.',
      alias: ['pe'],
    },
  ],
  [
    'open',
    {
      desc: 'Open a conversation with a user.',
      alias: ['o'],
    },
  ],
  [
    'exit',
    {
      desc: 'Exit the conversation you have open.',
    },
  ],
  [
    'reply',
    {
      desc: 'Reply to the last whisper you received.',
      alias: ['r'],
    },
  ],
  [
    'stalk',
    {
      desc: 'Return a list of messages from <nick>.',
      alias: ['s'],
    },
  ],
  [
    'mentions',
    {
      desc: 'Return a list of messages where <nick> is mentioned.',
      alias: ['m'],
    },
  ],
  [
    'showpoll',
    {
      desc: 'Show last poll.',
      alias: ['showvote'],
    },
  ],
  [
    'poll',
    {
      desc: 'Start a poll.',
      alias: ['vote'],
    },
  ],
  [
    'spoll',
    {
      desc: 'Start a sub-weighted poll.',
      alias: ['svote'],
    },
  ],
  [
    'pollstop',
    {
      desc: 'Stop a poll you started.',
      alias: ['votestop'],
    },
  ],
  [
    'pin',
    {
      desc: 'Pins a message to chat',
      admin: true,
      alias: ['motd'],
    },
  ],
  [
    'unpin',
    {
      desc: 'Unpins a message from chat',
      admin: true,
      alias: ['unmotd'],
    },
  ],
  [
    'host',
    {
      desc: 'Hosts a livestream, video, or vod to bigscreen.',
      admin: true,
    },
  ],
  [
    'unhost',
    {
      desc: 'Removes hosted content from bigscreen.',
      admin: true,
    },
  ],
]);
const banstruct = {
  id: 0,
  userid: 0,
  username: '',
  targetuserid: '',
  targetusername: '',
  ipaddress: '',
  reason: '',
  starttimestamp: '',
  endtimestamp: '',
};

class Chat {
  config: ChatConfig;
  ui: JQuery | null;
  css: CSSStyleSheet | null;
  output: JQuery | null;
  input: JQuery | null;
  subonlyicon: JQuery | null;
  loginscrn: JQuery | null;
  loadingscrn: JQuery | null;
  showmotd: boolean;
  subonly: boolean;
  ishidden: boolean;
  authenticated: boolean;
  backlogloading: boolean;
  busymentions: boolean;
  busystalk: boolean;
  nextallowedmentions: moment.Moment | null;
  nextallowedstalk: moment.Moment | null;
  unresolved: ChatUserMessage[];
  debouncedsave: debounce<() => void> | null;
  debounceFocus: debounce<(chat: this) => void> | null;

  flairs: WebsiteApiTypes.Flair[];
  flairsMap: Map<string, WebsiteApiTypes.Flair>;
  emoteService: EmoteService;

  user: ChatUser;
  users: Map<string, ChatUser>;
  whispers: Map<string, ChatWhisper>;
  windows: Map<string, ChatWindow>;
  settings: Map<string, unknown>;
  autocomplete: ChatAutoComplete;
  inputhistory: ChatInputHistory | null;
  userfocus: ChatUserFocus | null;
  mutedtimer: MutedTimer | null;
  chatpoll: ChatPoll | null;
  pinnedMessage: PinnedMessage | null;
  menus: Map<string, ChatMenu>;
  taggednicks: Map<string, string>;
  taggednotes: Map<string, string>;
  ignoring: Set<string>;
  mainwindow: ChatWindow | null;
  windowselect: JQuery | null;
  ignoreregex: RegExp | null;
  regexhighlightcustom: RegExp | null;
  regexhighlightnicks: RegExp | null;
  regexhighlightself: RegExp | null;
  replyusername: string | null;
  lasthintindex: number | null;

  control: EventEmitter;
  hashLinkConverter: HashLinkConverter;
  source: ChatSource;

  constructor(config: ChatConfig) {
    this.config = {
      cacheKey: '',
      banAppealUrl: null,
      amazonTags: null,
      welcomeMessage: 'Welcome to chat!',
      stalkEnabled: true,
      mentionsEnabled: true,
      ...config,
    };
    this.ui = null;
    this.css = null;
    this.output = null;
    this.input = null;
    this.subonlyicon = null;
    this.loginscrn = null;
    this.loadingscrn = null;
    this.showmotd = true;
    this.subonly = false;
    this.ishidden = true;
    this.authenticated = false;
    this.backlogloading = false;
    this.busymentions = false;
    this.busystalk = false;
    this.nextallowedmentions = null;
    this.nextallowedstalk = null;
    this.unresolved = [];
    this.debouncedsave = null;
    this.debounceFocus = null;

    this.flairs = [];
    this.flairsMap = new Map();
    this.emoteService = new EmoteService();

    this.user = new ChatUser();
    this.users = new Map();
    this.whispers = new Map();
    this.windows = new Map();
    this.settings = new Map(settingsdefault);
    this.autocomplete = new ChatAutoComplete(this);
    this.inputhistory = null;
    this.userfocus = null;
    this.mutedtimer = null;
    this.chatpoll = null;
    this.pinnedMessage = null;
    this.menus = new Map();
    this.taggednicks = new Map();
    this.taggednotes = new Map();
    this.ignoring = new Set();
    this.mainwindow = null;
    this.windowselect = null;
    this.ignoreregex = null;
    this.regexhighlightcustom = null;
    this.regexhighlightnicks = null;
    this.regexhighlightself = null;
    this.replyusername = null;
    this.lasthintindex = null;

    // An interface to tell the chat to do things via chat commands, or via emit
    // e.g. control.emit('CONNECT', 'ws://localhost:9001') is essentially chat.cmdCONNECT('ws://localhost:9001')
    this.control = new EventEmitter();
    // A converter to convert URLs into an embed hash link
    this.hashLinkConverter = new HashLinkConverter();
    // The websocket connection, emits events from the chat server
    this.source = new ChatSource();

    this.source.on('REFRESH', () => window.location.reload());
    this.source.on('PING', (data) => this.source.send('PONG', data));
    this.source.on('CONNECTING', (data) => this.onCONNECTING(data as string));
    this.source.on('OPEN', (data) => this.onOPEN(data));
    this.source.on('DISPATCH', (data) => this.onDISPATCH(data));
    this.source.on('CLOSE', (data) => this.onCLOSE(data as number));
    this.source.on('NAMES', (data) =>
      this.onNAMES(data as ChatWebsocketTypes.IN.Names)
    );
    this.source.on('PIN', (data) =>
      this.onPIN(data as ChatWebsocketTypes.IN.Pin)
    );
    this.source.on('QUIT', (data) =>
      this.onQUIT(data as ChatWebsocketTypes.IN.UserQuit)
    );
    this.source.on('MSG', (data) =>
      this.onMSG(data as ChatWebsocketTypes.IN.Message)
    );
    this.source.on('MUTE', (data) =>
      this.onMUTE(data as ChatWebsocketTypes.IN.Mute)
    );
    this.source.on('UNMUTE', (data) =>
      this.onUNMUTE(data as ChatWebsocketTypes.IN.Unmute)
    );
    this.source.on('BAN', (data) =>
      this.onBAN(data as ChatWebsocketTypes.IN.Ban)
    );
    this.source.on('UNBAN', (data) =>
      this.onUNBAN(data as ChatWebsocketTypes.IN.Unban)
    );
    this.source.on('ERR', (data) =>
      this.onERR(data as ChatWebsocketTypes.IN.Error)
    );
    this.source.on('SOCKETERROR', (data) => this.onSOCKETERROR(data));
    this.source.on('SUBONLY', (data) =>
      this.onSUBONLY(data as ChatWebsocketTypes.IN.SubOnly)
    );
    this.source.on('BROADCAST', (data) =>
      this.onBROADCAST(data as ChatWebsocketTypes.IN.Broadcast)
    );
    this.source.on('PRIVMSGSENT', () => this.onPRIVMSGSENT());
    this.source.on('PRIVMSG', (data) =>
      this.onPRIVMSG(data as ChatWebsocketTypes.IN.PrivateMessage)
    );
    this.source.on('POLLSTART', (data) =>
      this.onPOLLSTART(data as ChatWebsocketTypes.IN.PollStart)
    );
    this.source.on('POLLSTOP', () => this.onPOLLSTOP());
    this.source.on('VOTECAST', (data) =>
      this.onVOTECAST(data as ChatWebsocketTypes.IN.VoteCast)
    );

    this.control.on('SEND', (data) => this.cmdSEND(data as string));
    this.control.on('HINT', (data) => this.cmdHINT(data as string[]));
    this.control.on('EMOTES', () => this.cmdEMOTES());
    this.control.on('HELP', () => this.cmdHELP());
    this.control.on('IGNORE', (data) => this.cmdIGNORE(data as string[]));
    this.control.on('UNIGNORE', (data) => this.cmdUNIGNORE(data as string[]));
    this.control.on('UNIGNOREALL', (data) =>
      this.cmdUNIGNOREALL(data as string[])
    );
    this.control.on('MUTE', (data) => this.cmdMUTE(data as string[]));
    this.control.on('BAN', (data) => this.cmdBAN(data as string[], 'BAN'));
    this.control.on('IPBAN', (data) => this.cmdBAN(data as string[], 'IPBAN'));
    this.control.on('UNMUTE', (data) =>
      this.cmdUNBAN(data as string[], 'UNMUTE')
    );
    this.control.on('UNBAN', (data) =>
      this.cmdUNBAN(data as string[], 'UNBAN')
    );
    this.control.on('SUBONLY', (data) =>
      this.cmdSUBONLY(data as string[], 'SUBONLY')
    );
    this.control.on('MAXLINES', (data) =>
      this.cmdMAXLINES(data as string[], 'MAXLINES')
    );
    this.control.on('UNHIGHLIGHT', (data) =>
      this.cmdHIGHLIGHT(data as string[], 'UNHIGHLIGHT')
    );
    this.control.on('HIGHLIGHT', (data) =>
      this.cmdHIGHLIGHT(data as string[], 'HIGHLIGHT')
    );
    this.control.on('TIMESTAMPFORMAT', (data) =>
      this.cmdTIMESTAMPFORMAT(data as string[])
    );
    this.control.on('BROADCAST', (data) => this.cmdBROADCAST(data as string[]));
    this.control.on('CONNECT', (data) => this.cmdCONNECT(data as string[]));
    this.control.on('TAG', (data) => this.cmdTAG(data as string[]));
    this.control.on('UNTAG', (data) => this.cmdUNTAG(data as string[]));
    this.control.on('EMBED', (data) => this.cmdEMBED(data as string[]));
    this.control.on('E', (data) => this.cmdEMBED(data as string[]));
    this.control.on('POSTEMBED', (data) => this.cmdPOSTEMBED(data as string[]));
    this.control.on('PE', (data) => this.cmdPOSTEMBED(data as string[]));
    this.control.on('BANINFO', () => this.cmdBANINFO());
    this.control.on('OPEN', (data) => this.cmdOPEN(data as string[]));
    this.control.on('O', (data) => this.cmdOPEN(data as string[]));
    this.control.on('EXIT', () => this.cmdEXIT());
    this.control.on('MESSAGE', (data) => this.cmdWHISPER(data as string[]));
    this.control.on('MSG', (data) => this.cmdWHISPER(data as string[]));
    this.control.on('WHISPER', (data) => this.cmdWHISPER(data as string[]));
    this.control.on('W', (data) => this.cmdWHISPER(data as string[]));
    this.control.on('TELL', (data) => this.cmdWHISPER(data as string[]));
    this.control.on('T', (data) => this.cmdWHISPER(data as string[]));
    this.control.on('NOTIFY', (data) => this.cmdWHISPER(data as string[]));
    this.control.on('R', () => this.cmdREPLY());
    this.control.on('REPLY', () => this.cmdREPLY());
    this.control.on('MENTIONS', (data) => this.cmdMENTIONS(data as string[]));
    this.control.on('M', (data) => this.cmdMENTIONS(data as string[]));
    this.control.on('STALK', (data) => this.cmdSTALK(data as string[]));
    this.control.on('S', (data) => this.cmdSTALK(data as string[]));
    this.control.on('SHOWPOLL', () => this.cmdSHOWPOLL());
    this.control.on('SHOWVOTE', () => this.cmdSHOWPOLL());
    this.control.on('V', (data) => this.cmdPOLL(data as string[], 'POLL'));
    this.control.on('POLL', (data) => this.cmdPOLL(data as string[], 'POLL'));
    this.control.on('VOTE', (data) => this.cmdPOLL(data as string[], 'POLL'));
    this.control.on('SPOLL', (data) => this.cmdPOLL(data as string[], 'SPOLL'));
    this.control.on('SVOTE', (data) => this.cmdPOLL(data as string[], 'SPOLL'));
    this.control.on('POLLSTOP', () => this.cmdPOLLSTOP());
    this.control.on('VOTESTOP', () => this.cmdPOLLSTOP());
    this.control.on('VS', () => this.cmdPOLLSTOP());
    this.control.on('PIN', (data) => this.cmdPIN(data as string[]));
    this.control.on('MOTD', (data) => this.cmdPIN(data as string[]));
    this.control.on('UNPIN', () => this.cmdUNPIN());
    this.control.on('UNMOTD', () => this.cmdUNPIN());
    this.control.on('HOST', (data) => this.cmdHOST(data as string[]));
    this.control.on('UNHOST', () => this.cmdUNHOST());
  }

  setUser(user: ChatUser | null) {
    if (!user || user.username === '') {
      this.user = this.addUser(
        `User${Math.floor(Math.random() * (99999 - 10000 + 1))}${10000}`
      );
      this.authenticated = false;
    } else {
      this.user = this.addUser(user);
      this.authenticated = true;
    }
    this.setDefaultPlaceholderText();
    return this;
  }

  setSettings(settings: Map<string, unknown> | null = null) {
    // If authed and #settings.profilesettings=true use #settings
    // Else use whats in LocalStorage#chat.settings
    const stored =
      settings !== null && this.authenticated && settings.get('profilesettings')
        ? settings
        : new Map(ChatStore.read('chat.settings') || []);

    // Loop through settings and apply any settings found in the #stored data
    if (stored.size > 0) {
      [...this.settings.keys()]
        .filter((k) => stored.get(k) !== undefined && stored.get(k) !== null)
        .forEach((k) => this.settings.set(k, stored.get(k)));
    }
    // Upgrade if schema is out of date
    const oldversion = stored.has('schemaversion')
      ? parseInt(stored.get('schemaversion') as string, 10)
      : -1;
    const newversion = settingsdefault.get('schemaversion') as number;
    if (oldversion !== -1 && newversion > oldversion) {
      Settings.upgrade(this, oldversion);
      this.settings.set('schemaversion', newversion);
      this.saveSettings();
    }

    this.taggednicks = new Map(
      this.settings.get('taggednicks') as [string, string][]
    );
    this.taggednotes = new Map(
      this.settings.get('taggednotes') as [string, string][]
    );
    this.ignoring = new Set(this.settings.get('ignorenicks') as string[]);
    return this.applySettings(false);
  }

  withGui(template: string, appendTo = null) {
    this.ui = $(template);
    this.ui.prependTo(appendTo || 'body');

    // We use this style sheet to apply GUI updates via css (e.g. user focus)
    this.css = (() => {
      const link = document.createElement('style');
      link.id = 'chat-styles';
      link.type = 'text/css';
      document.getElementsByTagName('head')[0].appendChild(link);
      return link.sheet;
    })();

    this.ishidden = (document.visibilityState || 'visible') !== 'visible';
    this.output = this.ui.find('#chat-output-frame');
    this.input = this.ui.find('#chat-input-control');
    this.subonlyicon = this.ui.find('#chat-input-subonly');
    this.loginscrn = this.ui.find('#chat-login-screen');
    this.loadingscrn = this.ui.find('#chat-loading');
    this.windowselect = this.ui.find('#chat-windows-select');
    this.inputhistory = new ChatInputHistory(this);
    this.userfocus = new ChatUserFocus(this, this.css as CSSStyleSheet);
    this.mainwindow = new ChatWindow('main').into(this);
    this.mutedtimer = new MutedTimer(this);
    this.chatpoll = new ChatPoll(this);
    this.pinnedMessage = null;

    this.windowToFront('main');

    this.menus.set(
      'settings',
      new ChatSettingsMenu(
        this.ui.find('#chat-settings'),
        this.ui.find('#chat-settings-btn'),
        this
      )
    );
    this.menus.set(
      'emotes',
      new ChatEmoteMenu(
        this.ui.find('#chat-emote-list'),
        this.ui.find('#chat-emoticon-btn'),
        this
      )
    );
    this.menus.set(
      'emote-tooltip',
      new ChatEmoteTooltip(
        this.ui.find('#chat-emote-tooltip'),
        this.output.find('.msg-user .text .emote'),
        this
      )
    );
    this.menus.set(
      'users',
      new ChatUserMenu(
        this.ui.find('#chat-user-list'),
        this.ui.find('#chat-users-btn'),
        this
      )
    );
    this.menus.set(
      'whisper-users',
      new ChatWhisperUsers(
        this.ui.find('#chat-whisper-users'),
        this.ui.find('#chat-whisper-btn'),
        this
      )
    );
    this.menus.set(
      'user-info',
      new ChatUserInfoMenu(
        this.ui.find('#chat-user-info'),
        this.output.find('.msg-user .user'),
        this
      )
    );

    commandsinfo.forEach((a, k) => {
      this.autocomplete.add(`/${k}`);
      (a.alias || []).forEach((i) => this.autocomplete.add(`/${i}`));
    });

    this.autocomplete.bind(this);

    // Chat input
    // Dynamically adjust input's height.
    this.input.on('keydown input', this.adjustInputHeight.bind(this));

    // Set initial height.
    this.adjustInputHeight();

    this.input.on('keypress', (e) => {
      if (isKeyCode(e, KEYCODES.ENTER) && !e.shiftKey && !e.ctrlKey) {
        e.preventDefault();
        e.stopPropagation();
        if (this.input) {
          this.control.emit('SEND', (this.input.val() as string).trim());
          this.adjustInputHeight();
          this.input.trigger('focus');
        }
      }
    });

    // Chat focus / menu close when clicking on some areas
    let downinoutput = false;
    this.output.on('mousedown', () => {
      downinoutput = true;
    });
    this.output.on('mouseup', () => {
      if (downinoutput) {
        downinoutput = false;
        ChatMenu.closeMenus(this);
        this.focusIfNothingSelected();
      }
    });
    this.ui.on('click', '#chat-tools-wrap', () => {
      ChatMenu.closeMenus(this);
      this.focusIfNothingSelected();
    });

    // ESC
    document.addEventListener('keydown', (e) => {
      if (isKeyCode(e, KEYCODES.ESC)) ChatMenu.closeMenus(this); // ESC key
    });

    // Visibility
    document.addEventListener(
      'visibilitychange',
      debounce(
        100,
        () => {
          this.ishidden = (document.visibilityState || 'visible') !== 'visible';
          if (!this.ishidden) this.focusIfNothingSelected();
          else ChatMenu.closeMenus(this);
        },
        { atBegin: false }
      ),
      true
    );

    // Resize
    let resizing = false;
    const onresizecomplete = debounce(
      100,
      () => {
        resizing = false;
        this.focusIfNothingSelected();
      },
      { atBegin: false }
    );
    const onresize = () => {
      // If this is a mobile screen, don't close menus.
      // The virtual keyboard triggers a 'resize' event, and menus shouldn't be closed whenever the virtual keyboard is opened
      if (window.screen.width <= 768) {
        return;
      }

      if (!resizing) {
        resizing = true;
        ChatMenu.closeMenus(this);
      }
      onresizecomplete();
    };
    window.addEventListener('resize', onresize, false);

    // Chat user whisper tabs
    this.windowselect.on('click', '.tab-close', (e) => {
      ChatMenu.closeMenus(this);
      this.removeWindow($(e.currentTarget).parent().data('name').toLowerCase());
      (this.input as JQuery).trigger('focus');
      return false;
    });
    this.windowselect.on('click', '.tab', (e) => {
      ChatMenu.closeMenus(this);
      this.windowToFront($(e.currentTarget).data('name').toLowerCase());
      (this.menus.get('whisper-users') as ChatWhisperUsers).redraw();
      (this.input as JQuery).trigger('focus');
      return false;
    });

    // Censored
    this.output.on('click', '.censored', (e) => {
      const nick = $(e.currentTarget).closest('.msg-user').data('username');
      this.getActiveWindow()
        .getlines(`.censored[data-username="${nick}"]`)
        .forEach((line) => line.classList.remove('censored'));
      return false;
    });

    // Login
    this.loginscrn.on('click', '#chat-btn-login', () => {
      (this.loginscrn as JQuery).hide();
      try {
        (window.top as Window).showLoginModal();
      } catch (e) {
        const uri = `${window.location.protocol}//${window.location.hostname}${
          window.location.port ? `:${window.location.port}` : ''
        }`;
        try {
          if (window.self === window.top) {
            window.location.href = `${uri}/login?follow=${encodeURIComponent(
              window.location.pathname
            )}`;
          } else {
            window.location.href = `${uri}/login`;
          }
          return false;
        } catch (ignored) {} // eslint-disable-line no-empty
        window.location.href = `${uri}/login`;
      }
      return false;
    });

    this.loginscrn.on('click', '#chat-btn-cancel', () =>
      (this.loginscrn as JQuery).hide()
    );
    this.output.on('click mousedown', '.msg-whisper a.user', (e) => {
      const msg = $(e.target).closest('.msg-chat');
      this.openConversation(msg.data('username').toString().toLowerCase());
      return false;
    });

    this.loadingscrn.fadeOut(250, () => (this.loadingscrn as JQuery).remove());
    this.mainwindow.update(true);

    this.setDefaultPlaceholderText();
    MessageBuilder.status(this.config.welcomeMessage as string).into(this);
    return Promise.resolve(this);
  }

  connect() {
    this.source.connect(this.config.url);
  }

  async loadUserAndSettings() {
    return fetch(`${this.config.api.base}/api/chat/me`, {
      credentials: 'include',
    })
      .then((res) => res.json())
      .then((data) => {
        this.setUser(data);
        this.setSettings(new Map(data.settings));
      })
      .catch(() => {
        this.setUser(null);
        this.setSettings();
      });
  }

  async loadEmotesAndFlairs() {
    await this.loadEmotes();
    await this.loadFlairs();
  }

  async loadEmotes() {
    Chat.loadCss(
      `${this.config.cdn.base}/emotes/emotes.css?_=${this.config.cacheKey}`
    );
    return fetch(
      `${this.config.cdn.base}/emotes/emotes.json?_=${this.config.cacheKey}`
    )
      .then((res) => res.json())
      .then((json) => {
        this.setEmotes(json);
      })
      .catch(() => {});
  }

  async loadFlairs() {
    Chat.loadCss(
      `${this.config.cdn.base}/flairs/flairs.css?_=${this.config.cacheKey}`
    );
    return fetch(
      `${this.config.cdn.base}/flairs/flairs.json?_=${this.config.cacheKey}`
    )
      .then((res) => res.json())
      .then((json) => {
        this.setFlairs(json);
      })
      .catch(() => {});
  }

  async loadHistory() {
    return fetch(`${this.config.api.base}/api/chat/history`)
      .then((res) => res.json())
      .then((json) => {
        this.setHistory(json);
      })
      .catch(() => {});
  }

  async loadWhispers() {
    if (this.authenticated) {
      fetch(`${this.config.api.base}/api/messages/unread`, {
        credentials: 'include',
      })
        .then((res) => res.json())
        .then((d: WebsiteApiTypes.UnreadWhisper[]) => {
          d.forEach((e) =>
            this.whispers.set(e.username.toLowerCase(), {
              id: e.messageid,
              nick: e.username,
              unread: Number(e.unread),
              open: false,
            })
          );
        })
        .then(() =>
          (this.menus.get('whisper-users') as ChatWhisperUsers).redraw()
        )
        .catch(() => {});
    }
  }

  setEmotes(emotes: WebsiteApiTypes.Emote[]) {
    this.emoteService.setEmotes(emotes);
    this.emoteService
      .emotesForUser(this.user)
      .map((e) => e.prefix)
      .forEach((e) => this.autocomplete.add(e, true));
    return this;
  }

  setFlairs(flairs: WebsiteApiTypes.Flair[]) {
    this.flairs = flairs;
    this.flairsMap = new Map();
    flairs.forEach((v) => this.flairsMap.set(v.name, v));
    return this;
  }

  setHistory(history: string[]) {
    if (history && history.length > 0) {
      this.backlogloading = true;
      history.forEach((line) =>
        this.source.parseAndDispatch({ data: line } as MessageEvent)
      );
      this.backlogloading = false;
      MessageBuilder.element('<hr/>').into(this);
      (this.mainwindow as ChatWindow).update(true);
    }
    return this;
  }

  saveSettings() {
    if (this.authenticated) {
      if (this.settings.get('profilesettings')) {
        fetch(`${this.config.api.base}/api/chat/me/settings`, {
          body: JSON.stringify([...this.settings]),
          credentials: 'include',
          method: 'POST',
          headers: { 'X-CSRF-Guard': 'YEE' },
        }).catch();
      } else {
        ChatStore.write('chat.settings', this.settings);
      }
    } else {
      ChatStore.write('chat.settings', this.settings);
    }
  }

  // De-bounced saveSettings
  commitSettings() {
    if (!this.debouncedsave) {
      this.debouncedsave = debounce(1000, () => this.saveSettings(), {
        atBegin: false,
      });
    }
    this.debouncedsave();
  }

  // Save settings if save=true then apply current settings to chat
  applySettings(save = true) {
    if (save) this.saveSettings();

    // Formats
    // TODO: cannot assign value to const
    // DATE_FORMATS.TIME = this.settings.get('timestampformat');

    // Ignore Regex
    const ignores = Array.from(this.ignoring.values()).map(makeSafeForRegex);
    this.ignoreregex =
      ignores.length > 0
        ? new RegExp(`\\b(?:${ignores.join('|')})\\b`, 'i')
        : null;

    // Highlight Regex
    const cust = [
      ...((this.settings.get('customhighlight') as string[]) || []),
    ].filter((a) => a !== '');
    const nicks = [
      ...((this.settings.get('highlightnicks') as string[]) || []),
    ].filter((a) => a !== '');
    this.regexhighlightself = this.user.nick
      ? new RegExp(`\\b(?:${this.user.nick})\\b`, 'i')
      : null;
    this.regexhighlightcustom =
      cust.length > 0 ? new RegExp(`\\b(?:${cust.join('|')})\\b`, 'i') : null;
    this.regexhighlightnicks =
      nicks.length > 0 ? new RegExp(`\\b(?:${nicks.join('|')})\\b`, 'i') : null;

    // Settings Css
    Array.from(this.settings.keys())
      .filter((key) => typeof this.settings.get(key) === 'boolean')
      .forEach((key) =>
        (this.ui as JQuery).toggleClass(
          `pref-${key}`,
          this.settings.get(key) as boolean
        )
      );

    // Update maxlines
    [...this.windows.values()].forEach((w) => {
      w.maxlines = this.settings.get('maxlines') as number;
    });

    // Font scaling
    // TODO document.body :(
    const fontscale = (this.settings.get('fontscale') as string) || 'auto';
    $(document.body).toggleClass(`pref-fontscale`, fontscale !== 'auto');
    $(document.body).attr('data-fontscale', fontscale);
    return Promise.resolve(this);
  }

  addUser(
    data: string | ChatWebsocketTypes.IN.SimplifiedUser | null
  ): ChatUser {
    if (!data) return new ChatUser();
    if (typeof data === 'string') return new ChatUser(data);
    const normalized = data.nick.toLowerCase();
    let user = this.users.get(normalized);
    if (!user) {
      user = new ChatUser(data);
      this.users.set(normalized, user);
    } else {
      if (
        (data as ChatWebsocketTypes.IN.SimplifiedUser).features &&
        !Chat.isArraysEqual(
          (data as ChatWebsocketTypes.IN.SimplifiedUser).features,
          user.features
        )
      ) {
        user.features = (data as ChatWebsocketTypes.IN.SimplifiedUser).features;
      }
      if (
        (data as ChatWebsocketTypes.IN.SimplifiedUser).createdDate &&
        (data as ChatWebsocketTypes.IN.SimplifiedUser).createdDate !==
          user.createdDate
      ) {
        user.createdDate = (
          data as ChatWebsocketTypes.IN.SimplifiedUser
        ).createdDate;
      }
    }
    return user;
  }

  addMessage(message: ChatUIMessage, win: ChatWindow | null = null) {
    // Don't add the gui if user is ignored
    if (
      message.type === MessageTypes.USER &&
      this.ignored((message as ChatUserMessage).user.nick, message.message)
    )
      return;

    // eslint-disable-next-line no-param-reassign
    if (win === null) win = this.mainwindow as ChatWindow;

    // Break the current combo if this message is not an emote
    // We don't need to check what type the current message is, we just know that its a new message, so the combo is invalid.
    if (
      win.lastmessage &&
      win.lastmessage.type === MessageTypes.EMOTE &&
      (win.lastmessage as ChatEmoteMessage).emotecount > 1
    ) {
      (win.lastmessage as ChatEmoteMessage).completeCombo();
    }

    // Populate the tag, mentioned users and highlight for this $message.
    if (message.type === MessageTypes.USER) {
      // check if message is `/me `
      (message as ChatUserMessage).slashme =
        message.message.substring(0, 4).toLowerCase() === '/me ';
      // check if this is the current users message
      (message as ChatUserMessage).isown =
        (message as ChatUserMessage).user.username.toLowerCase() ===
        this.user.username.toLowerCase();
      // check if the last message was from the same user
      (message as ChatUserMessage).continued =
        (win.lastmessage as ChatUserMessage) &&
        !(win.lastmessage as ChatUserMessage).target &&
        (win.lastmessage as ChatUserMessage).user &&
        (win.lastmessage as ChatUserMessage).user.username.toLowerCase() ===
          (message as ChatUserMessage).user.username.toLowerCase();
      // get mentions from message
      (message as ChatUserMessage).mentioned = Chat.extractNicks(
        message.message
      ).filter((a) => this.users.has(a.toLowerCase()));
      // set tagged state
      (message as ChatUserMessage).tag =
        this.taggednicks.get(
          (message as ChatUserMessage).user.nick.toLowerCase()
        ) || null;
      // set tagged note
      (message as ChatUserMessage).title =
        this.taggednotes.get(
          (message as ChatUserMessage).user.nick.toLowerCase()
        ) || '';
      // set highlighted state
      (message as ChatUserMessage).highlighted =
        /* this.authenticated && */ !(message as ChatUserMessage).isown &&
        // Check current user nick against msg.message (if highlight setting is on)
        (((this.regexhighlightself &&
          (this.settings.get('highlight') as boolean) &&
          this.regexhighlightself.test(message.message)) ||
          // Check /highlight nicks against msg.nick
          (this.regexhighlightnicks &&
            this.regexhighlightnicks.test(
              (message as ChatUserMessage).user.username
            )) ||
          // Check custom highlight against msg.nick and msg.message
          (this.regexhighlightcustom &&
            this.regexhighlightcustom.test(
              `${(message as ChatUserMessage).user.username} ${message.message}`
            ))) as boolean);
    }

    // This looks odd, although it would be a correct implementation
    /* else if(win.lastmessage && win.lastmessage.type === message.type && [MessageTypes.ERROR,MessageTypes.INFO,MessageTypes.COMMAND,MessageTypes.STATUS].indexOf(message.type)){
            message.continued = true
        } */

    // The point where we actually add the message dom
    win.addMessage(this, message);

    // Show desktop notification
    if (
      !this.backlogloading &&
      (message as ChatUserMessage).highlighted &&
      this.settings.get('notificationhighlight') &&
      this.ishidden
    ) {
      Chat.showNotification(
        `${(message as ChatUserMessage).user.username} said ...`,
        message.message,
        (message as ChatUserMessage).timestamp.valueOf(),
        this.settings.get('notificationtimeout') as boolean
      );
    }

    win.update();
  }

  resolveMessage(nick: string, str: string) {
    for (const message of this.unresolved) {
      if (
        this.user.username.toLowerCase() === nick.toLowerCase() &&
        message.message === str
      ) {
        this.unresolved.splice(this.unresolved.indexOf(message), 1);
        return true;
      }
    }
    return false;
  }

  removeMessageByNick(nick: string) {
    (this.mainwindow as ChatWindow).removelines(
      `.msg-chat[data-username="${nick.toLowerCase()}"]`
    );
    (this.mainwindow as ChatWindow).update();
  }

  windowToFront(name: string) {
    const win = this.windows.get(name);
    if (win !== undefined) {
      if (win !== this.getActiveWindow()) {
        this.windows.forEach((w) => {
          if (w.visible) w.hide();
        });
        win.show();
        win.update();
        this.redrawWindowIndicators();
      }

      if (win.name === 'main' && this.mutedtimer && this.mutedtimer.ticking) {
        this.mutedtimer.updatePlaceholderText();
      } else {
        this.setDefaultPlaceholderText();
      }
    }

    return win;
  }

  getActiveWindow() {
    return [...this.windows.values()].filter((win) => win.visible)[0];
  }

  getWindow(name: string) {
    return this.windows.get(name);
  }

  addWindow(name: string, win: ChatWindow) {
    this.windows.set(name, win);
    this.redrawWindowIndicators();
  }

  removeWindow(name: string) {
    const win = this.windows.get(name);
    if (win) {
      const { visible } = win;
      this.windows.delete(name);
      win.destroy();
      if (visible) {
        const keys = [...this.windows.keys()];
        this.windowToFront(
          (this.windows.get(keys[keys.length - 1]) as ChatWindow).name
        );
      } else {
        this.redrawWindowIndicators();
      }
    }
  }

  redrawWindowIndicators() {
    if (this.windows.size > 1) {
      (this.windowselect as JQuery).empty();
      this.windows.forEach((w) => {
        if (w.name === 'main') {
          (this.windowselect as JQuery).append(
            `<span title="Destiny GG" data-name="main" class="tab win-main tag-${
              w.tag
            } ${w.visible ? 'active' : ''}"><i class="dgg-icon"></i></span>`
          );
        } else {
          const conv = this.whispers.get(w.name) as ChatWhisper;
          (this.windowselect as JQuery).append(`<span title="${
            w.label
          }" data-name="${w.name}" class="tab win-${w.name} tag-${w.tag} ${
            w.visible ? 'active' : ''
          } ${conv.unread > 0 ? 'unread' : ''}">
                    <span>${w.label}${
            conv.unread > 0 ? ` (${conv.unread})` : ''
          }</span>
                    <i class="tab-close" title="Close" />
                    </span>`);
        }
      });
    }

    (this.windowselect as JQuery).toggle(this.windows.size > 1);

    if (this.mainwindow !== null) this.mainwindow.update();
  }

  censor(nick: string) {
    const c = (this.mainwindow as ChatWindow).getlines(
      `.msg-chat[data-username="${nick.toLowerCase()}"]`
    );
    switch ((this.settings.get('showremoved') as number) || 1) {
      case 0: // remove
        c.forEach((line) => line.remove());
        break;
      case 1: // censor
        c.forEach((line) => line.classList.add('censored'));
        break;
      case 2: // do nothing
      default:
        break;
    }
    (this.mainwindow as ChatWindow).update();
  }

  ignored(nick: string, text: string | null = null) {
    const ignore = this.ignoring.has(nick.toLowerCase());
    if (!ignore && text !== null) {
      return (
        (this.settings.get('ignorementions') &&
          this.ignoreregex &&
          this.ignoreregex.test(text)) ||
        (this.settings.get('hidensfw') &&
          this.settings.get('hidensfl') &&
          nsfwnsflregex.test(text)) ||
        (this.settings.get('hidensfl') && nsflregex.test(text)) ||
        (this.settings.get('hidensfw') && nsfwregex.test(text))
      );
    }
    return ignore;
  }

  ignore(nick: string, ignore = true) {
    const normalizedNick = nick.toLowerCase();
    const exists = this.ignoring.has(normalizedNick);
    if (ignore && !exists) {
      this.ignoring.add(normalizedNick);
    } else if (!ignore && exists) {
      this.ignoring.delete(normalizedNick);
    }
    this.settings.set('ignorenicks', [...this.ignoring]);
    this.applySettings();
  }

  unignoreall() {
    this.ignoring.clear();
    this.settings.set('ignorenicks', [...this.ignoring]);
    this.applySettings();
  }

  focusIfNothingSelected() {
    // If this is a mobile screen, return to avoid focusing input and bringing up the virtual keyboard
    if (window.screen.width <= 768) {
      return;
    }

    if (this.debounceFocus === null) {
      this.debounceFocus = debounce(10, (c) => c.input.trigger('focus'), {
        atBegin: false,
      });
    }
    if (
      (window.getSelection() as Selection).isCollapsed &&
      !(this.input as JQuery).is(':focus')
    ) {
      this.debounceFocus(this);
    }
  }

  setDefaultPlaceholderText() {
    const placeholderText = this.authenticated
      ? `Write something ${this.user.username} ...`
      : `Write something ...`;
    (this.input as JQuery).attr('placeholder', placeholderText);
  }

  adjustInputHeight() {
    // Check if the input exists on the page and return if it doesn't.
    if (!this.input || (this.input as JQuery).length === 0) {
      return;
    }

    const maxHeightPixels = this.input.css('maxHeight');
    const maxHeight = parseInt(maxHeightPixels.slice(0, -2), 10);

    this.input.css('height', '');
    const calculatedHeight = this.input.prop('scrollHeight');

    // Show scrollbars if the input's height exceeds the max.
    this.input.css(
      'overflow-y',
      calculatedHeight >= maxHeight ? 'scroll' : 'hidden'
    );

    this.input.css('height', calculatedHeight);
    this.getActiveWindow().update();
  }

  /**
   * EVENTS
   */

  onDISPATCH(data: unknown) {
    if (typeof data === 'object') {
      let users = [];
      const now = Date.now();
      if ((data as ChatWebsocketTypes.IN.SimplifiedUser).nick)
        users.push(this.addUser(data as ChatWebsocketTypes.IN.SimplifiedUser));
      if ((data as ChatWebsocketTypes.IN.Names).users) {
        users = users.concat(
          Array.from((data as ChatWebsocketTypes.IN.Names).users).map((user) =>
            this.addUser(user)
          )
        );
      }
      users.forEach((u) => this.autocomplete.add(u.nick, false, now));
    }
  }

  onCLOSE(retryMilli: number) {
    if (this.chatpoll && this.chatpoll.isPollStarted()) this.chatpoll.endPoll(); // end poll on disconnect so it is not there forever.
    if (retryMilli > 0)
      MessageBuilder.error(
        `Disconnected, retry in ${Math.round(retryMilli / 1000)} seconds ...`
      ).into(this);
    else MessageBuilder.error(`Disconnected.`).into(this);
  }

  onCONNECTING(url: string) {
    if (this.authenticated) {
      MessageBuilder.status(
        `Connecting as ${this.user.username} to ${Chat.extractHostname(
          url
        )} ...`
      ).into(this);
    } else {
      MessageBuilder.status(
        `Connecting to ${Chat.extractHostname(url)} ...`
      ).into(this);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onOPEN(data: unknown) {
    // MessageBuilder.status(`Connection established.`).into(this)
  }

  onNAMES(data: ChatWebsocketTypes.IN.Names) {
    MessageBuilder.status(
      `Connected. Serving ${data.connectioncount || 0} connections and ${
        data.users.length
      } users.`
    ).into(this);
    if (this.showmotd) {
      this.cmdHINT([Math.floor(Math.random() * hintstrings.size).toString()]);
      this.showmotd = false;
    }
  }

  onPIN(data: ChatWebsocketTypes.IN.Pin) {
    if (this.pinnedMessage?.uuid === data.uuid) return;
    this.pinnedMessage?.unpin();
    if (!data.data) return;

    const usr = this.users.get(data.nick.toLowerCase()) ?? new ChatUser(data);
    this.pinnedMessage = MessageBuilder.pinned(
      data.data,
      usr,
      data.timestamp,
      data.uuid
    )
      .into(this)
      .pin(this, !checkIfPinWasDismissed(data.uuid));
  }

  onQUIT(data: ChatWebsocketTypes.IN.UserQuit) {
    const normalized = data.nick.toLowerCase();
    if (this.users.has(normalized)) {
      this.users.delete(normalized);
      this.autocomplete.remove(data.nick, true);
    }
  }

  onMSG(data: ChatWebsocketTypes.IN.Message) {
    const textonly = Chat.removeSlashCmdFromText(data.data);
    const usr = this.users.get(data.nick.toLowerCase());
    const win = this.mainwindow as ChatWindow;
    if (
      win.lastmessage !== null &&
      this.emoteService.canUserUseEmote(usr as ChatUser, textonly) &&
      Chat.removeSlashCmdFromText(win.lastmessage.message) === textonly
    ) {
      if (win.lastmessage.type === MessageTypes.EMOTE) {
        (win.lastmessage as ChatEmoteMessage).incEmoteCount();
        (this.mainwindow as ChatWindow).update();
      } else {
        (win.lastmessage.ui as HTMLDivElement).remove();
        MessageBuilder.emote(textonly, data.timestamp, 2).into(this);
      }
    } else if (!this.resolveMessage(data.nick, data.data)) {
      MessageBuilder.message(data.data, usr as ChatUser, data.timestamp).into(
        this
      );
    }
  }

  onPOLLSTART(data: ChatWebsocketTypes.IN.PollStart) {
    (this.chatpoll as ChatPoll).startPoll(data);
  }

  onPOLLSTOP() {
    (this.chatpoll as ChatPoll).endPoll();
  }

  onVOTECAST(data: ChatWebsocketTypes.IN.VoteCast) {
    const usr = this.users.get(data.nick.toLowerCase());
    (this.chatpoll as ChatPoll).castVote(data, usr as ChatUser);
    if (data.nick.toLowerCase() === this.user.nick.toLowerCase()) {
      (this.chatpoll as ChatPoll).markVote(parseInt(data.vote, 10));
    }
  }

  onMUTE(data: ChatWebsocketTypes.IN.Mute) {
    // data.data is the nick which has been banned
    if (this.user.username.toLowerCase() === data.data.toLowerCase()) {
      MessageBuilder.command(
        `You have been muted by ${data.nick}.`,
        data.timestamp
      ).into(this);

      // Every cached mute message calls `onMUTE()`. We perform this check
      // to avoid setting the timer for mutes that have already expired.
      if (isMuteActive(data)) {
        (this.mutedtimer as MutedTimer).setTimer(data.duration);
        (this.mutedtimer as MutedTimer).startTimer();
      }
    } else {
      MessageBuilder.command(
        `${data.data} muted by ${data.nick}.`,
        data.timestamp
      ).into(this);
    }
    this.censor(data.data);
  }

  onUNMUTE(data: ChatWebsocketTypes.IN.Unmute) {
    if (this.user.username.toLowerCase() === data.data.toLowerCase()) {
      MessageBuilder.command(
        `You have been unmuted by ${data.nick}.`,
        data.timestamp
      ).into(this);

      (this.mutedtimer as MutedTimer).stopTimer();
    } else {
      MessageBuilder.command(
        `${data.data} unmuted by ${data.nick}.`,
        data.timestamp
      ).into(this);
    }
  }

  onBAN(data: ChatWebsocketTypes.IN.Ban) {
    // data.data is the nick which has been banned, no info about duration
    if (this.user.username.toLowerCase() === data.data.toLowerCase()) {
      MessageBuilder.command(
        `You have been banned by ${data.nick}. Check your profile for more information.`,
        data.timestamp
      ).into(this);
      this.cmdBANINFO();
    } else {
      MessageBuilder.command(
        `${data.data} banned by ${data.nick}.`,
        data.timestamp
      ).into(this);
    }
    this.censor(data.data);
  }

  onUNBAN(data: ChatWebsocketTypes.IN.Unban) {
    if (this.user.username.toLowerCase() === data.data.toLowerCase()) {
      MessageBuilder.command(
        `You have been unbanned by ${data.nick}.`,
        data.timestamp
      ).into(this);

      // Unbanning a user unmutes them, too.
      (this.mutedtimer as MutedTimer).stopTimer();
    } else {
      MessageBuilder.command(
        `${data.data} unbanned by ${data.nick}.`,
        data.timestamp
      ).into(this);
    }
  }

  // not to be confused with an error the chat.source may send onSOCKETERROR.
  onERR(data: ChatWebsocketTypes.IN.Error) {
    const desc = data.description;
    if (desc === 'toomanyconnections' || desc === 'banned') {
      this.source.retryOnDisconnect = false;
    }

    let message;

    switch (desc) {
      case 'banned': {
        let messageText =
          'You have been banned! Check your <a target="_blank" class="externallink" href="/profile" rel="nofollow">profile</a> for more information. <a target="_blank" class="externallink" href="/subscribe" rel="nofollow">Subscribing</a> or <a target="_blank" class="externallink" href="/donate" rel="nofollow">donating</a> removes non-permanent bans.';

        // Append ban appeal hint if a URL was provided.
        if (this.config.banAppealUrl) {
          messageText += ` Visit <a target="_blank" class="externallink" href="${this.config.banAppealUrl}" rel="nofollow">this page</a> to appeal.`;
        }

        // Use an unformatted `ChatMessage` to preserve the message's embedded HTML.
        message = new ChatMessage(messageText, null, MessageTypes.ERROR, true);
        break;
      }
      case 'muted':
        (this.mutedtimer as MutedTimer).setTimer(data.muteTimeLeft);
        (this.mutedtimer as MutedTimer).startTimer();

        message = MessageBuilder.error(
          `You are temporarily muted! You can chat again ${(
            this.mutedtimer as MutedTimer
          ).getReadableDuration()}. Subscribe to remove the mute immediately.`
        );
        break;
      default:
        message = MessageBuilder.error(errorstrings.get(desc) || desc);
    }

    message.into(this, this.getActiveWindow());
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onSOCKETERROR(data: unknown) {
    // There is no information on the Error event of the socket.
    // We rely on the socket close event to tell us more about what happened.
    // MessageBuilder.error(errorstrings.get('socketerror')).into(this, this.getActiveWindow())
    // console.error(e)
  }

  onSUBONLY(data: ChatWebsocketTypes.IN.SubOnly) {
    this.subonly = data.data === 'on';
    MessageBuilder.command(
      `Subscriber only mode ${this.subonly ? 'enabled' : 'disabled'}${
        data.nick ? ` by ${data.nick}` : ''
      }.`,
      data.timestamp
    ).into(this);
    if (this.subonly && !this.user.isSubscriber()) {
      (this.subonlyicon as JQuery).show();
    } else {
      (this.subonlyicon as JQuery).hide();
    }
  }

  onBROADCAST(data: ChatWebsocketTypes.IN.Broadcast) {
    // TODO kind of ... hackey
    if (data.data === 'reload') {
      if (!this.backlogloading) {
        const retryMilli = Math.floor(Math.random() * 30000) + 4000;
        setTimeout(() => window.location.reload(), retryMilli);
        MessageBuilder.broadcast(
          `Restart incoming in ${Math.round(retryMilli / 1000)} seconds ...`
        ).into(this);
      }
    } else {
      MessageBuilder.broadcast(data.data, data.timestamp).into(this);
    }
  }

  onPRIVMSGSENT() {
    if ((this.mainwindow as ChatWindow).visible) {
      MessageBuilder.info('Your message has been sent.').into(this);
    }
  }

  onPRIVMSG(data: ChatWebsocketTypes.IN.PrivateMessage) {
    const normalized = data.nick.toLowerCase();
    if (!this.ignored(normalized, data.data)) {
      if (!this.whispers.has(normalized))
        this.whispers.set(normalized, {
          id: '',
          nick: data.nick,
          unread: 0,
          open: false,
        });

      const conv = this.whispers.get(normalized) as ChatWhisper;
      const user = this.users.get(normalized) || new ChatUser(data.nick);
      const messageid = data.messageid || null;
      if (this.settings.get('showhispersinchat'))
        MessageBuilder.whisper(
          data.data,
          user,
          this.user.username,
          data.timestamp,
          messageid
        ).into(this);
      if (this.settings.get('notificationwhisper') && this.ishidden)
        Chat.showNotification(
          `${data.nick} whispered ...`,
          data.data,
          data.timestamp,
          this.settings.get('notificationtimeout') as boolean
        );

      const win = this.getWindow(normalized);
      if (win)
        MessageBuilder.historical(data.data, user, data.timestamp).into(
          this,
          win
        );
      if (win === this.getActiveWindow()) {
        fetch(`${this.config.api.base}/api/messages/msg/${messageid}/open`, {
          credentials: 'include',
          method: 'POST',
          headers: { 'X-CSRF-Guard': 'YEE' },
        }).catch();
      } else {
        conv.unread += 1;
      }
      this.replyusername = user.username;
      (this.menus.get('whisper-users') as ChatWhisperUsers).redraw();
      this.redrawWindowIndicators();
    }
  }

  /**
   * COMMANDS
   */

  cmdSEND(raw: string) {
    if (raw !== '') {
      const win = this.getActiveWindow();
      const matches = raw.match(regexslashcmd);
      const iscommand = matches && matches.length > 1;
      const ismecmd = iscommand && matches[1].toLowerCase() === 'me';
      const textonly = Chat.removeSlashCmdFromText(raw);

      // COMMAND
      if (iscommand && !ismecmd) {
        const command = matches[1].toUpperCase();
        const normalized = command.toUpperCase();

        // Clear the input and add to history, before we do the emit
        // This makes it possible for commands to change the input.value, else it would be cleared after the command is run.
        (this.inputhistory as ChatInputHistory).add(raw);
        (this.input as JQuery).val('');

        if (win !== this.mainwindow && normalized !== 'EXIT') {
          MessageBuilder.error(
            `No commands in private windows. Try /exit`
          ).into(this, win);
        } else if (this.control.listeners.has(normalized)) {
          const parts = (raw.substring(command.length + 1) || '').match(
            /([^ ]+)/g
          );
          this.control.emit(normalized, parts || []);
        } else {
          MessageBuilder.error(`Unknown command. Try /help`).into(this, win);
        }
      }
      // LOGIN
      else if (!this.authenticated) {
        (this.loginscrn as JQuery).show();
      }
      // WHISPER
      else if (win !== this.mainwindow) {
        MessageBuilder.message(raw, this.user).into(this, win);
        this.source.send('PRIVMSG', { nick: win.name, data: raw });
        (this.input as JQuery).val('');
      }
      // VOTE
      else if (
        this.chatpoll &&
        this.chatpoll.isPollStarted() &&
        this.chatpoll.isMsgVoteCastFmt(textonly)
      ) {
        if (this.chatpoll.poll?.canVote) {
          MessageBuilder.info(`Your vote has been cast!`).into(this);
          this.source.send('CASTVOTE', { vote: raw });
          (this.input as JQuery).val('');
        } else {
          MessageBuilder.error(`You have already voted!`).into(this);
          (this.input as JQuery).val('');
        }
      }
      // EMOTE SPAM
      else if (
        this.source.isConnected() &&
        this.emoteService.getEmote(textonly)
      ) {
        // Its easier to deal with combos with the this.unresolved flow
        this.source.send('MSG', { data: raw });
        (this.inputhistory as ChatInputHistory).add(raw);
        (this.input as JQuery).val('');
      }
      // MESSAGE
      else {
        // We add the message to the gui immediately
        // But we will also get the MSG event, so we need to make sure we dont add the message to the gui again.
        // We do this by storing the message in the unresolved array
        // The onMSG then looks in the unresolved array for the message using the nick + message
        // If found, the message is not added to the gui, its removed from the unresolved array and the message.resolve method is run on the message
        const message = MessageBuilder.message(raw, this.user).into(this);
        this.unresolved.unshift(message);
        this.source.send('MSG', { data: raw });
        (this.inputhistory as ChatInputHistory).add(raw);
        (this.input as JQuery).val('');
      }
    }
  }

  cmdSHOWPOLL() {
    if (this.chatpoll && this.chatpoll.poll) {
      this.chatpoll.show();
    } else {
      MessageBuilder.error("There hasn't been a poll yet.").into(this);
    }
  }

  cmdPOLL(parts: string[], command: string) {
    const slashCommand = `/${command.toLowerCase()}`;
    const textOnly = parts.join(' ');

    try {
      // Assume the command's format is invalid if an exception is thrown.
      parseQuestionAndTime(textOnly);
    } catch {
      MessageBuilder.info(
        `Usage: ${slashCommand} <question>? <option 1> or <option 2> [or <option 3> [or <option 4> ... [or <option n>]]] [<time>].`
      ).into(this);
      return;
    }

    if (this.chatpoll && this.chatpoll.isPollStarted()) {
      MessageBuilder.error('Poll already started.').into(this);
      return;
    }

    if (this.chatpoll && !this.chatpoll.hasPermission(this.user)) {
      MessageBuilder.error('You do not have permission to start a poll.').into(
        this
      );
      return;
    }

    const { question, options, time } = parseQuestionAndTime(textOnly);
    const dataOut = {
      weighted: slashCommand === '/spoll',
      time,
      question,
      options,
    };
    this.source.send('STARTPOLL', dataOut);
  }

  cmdPOLLSTOP() {
    if (this.chatpoll && !this.chatpoll.isPollStarted()) {
      MessageBuilder.error('No poll started.').into(this);
      return;
    }
    if (this.chatpoll && !this.chatpoll.hasPermission(this.user)) {
      MessageBuilder.error(
        'You do not have permission to stop this poll.'
      ).into(this);
      return;
    }

    this.source.send('STOPPOLL', {});
  }

  cmdEMOTES() {
    MessageBuilder.info(
      `Available emotes: ${this.emoteService.prefixes.join(', ')}.`
    ).into(this);
  }

  cmdHELP() {
    let str = `Available commands: \r`;
    commandsinfo.forEach((a, k) => {
      str += a.alias
        ? ` /${k}, /${a.alias.join(', /')} - ${a.desc} \r`
        : ` /${k} - ${a.desc} \r`;
    });
    MessageBuilder.info(str).into(this);
  }

  cmdHINT(parts: string[]) {
    const arr = [...hintstrings];
    const i = parts && parts[0] ? parseInt(parts[0], 10) - 1 : -1;
    if (i > 0 && i < hintstrings.size) {
      MessageBuilder.info(arr[i][1]).into(this);
    } else {
      if (
        this.lasthintindex === null ||
        this.lasthintindex === arr.length - 1
      ) {
        this.lasthintindex = 0;
      } else {
        this.lasthintindex += 1;
      }
      MessageBuilder.info(arr[this.lasthintindex][1]).into(this);
    }
  }

  cmdIGNORE(parts: string[]) {
    if (!parts[0]) {
      if (this.ignoring.size <= 0) {
        MessageBuilder.info('Your ignore list is empty.').into(this);
      } else {
        MessageBuilder.info(
          `Ignoring the following people: ${Array.from(
            this.ignoring.values()
          ).join(', ')}.`
        ).into(this);
      }
    } else if (
      parts.some(
        (username) => username.toLowerCase() === this.user.nick.toLowerCase()
      )
    ) {
      MessageBuilder.info("You can't add yourself to your ignore list.").into(
        this
      );
    } else {
      // this is a little ugly, but it allows us to not ignore anything if there's an invalid nick in there
      // think that's less confusing/nicer compared to partially ignoring
      const validUsernames = new Set<string>();
      // .some() stops iterating over the array if the inner function returns true
      // which is perfect for our use case
      const failure = parts.some((username) => {
        if (!nickregex.test(username)) {
          MessageBuilder.info(
            `${username} is not a valid nick - /ignore <nick> OR /ignore <nick_1> <nick_2> ... <nick_n>.`
          ).into(this);
          return true;
        }
        validUsernames.add(username);
        return false;
      });
      if (!failure) {
        validUsernames.forEach((username) => {
          this.ignore(username, true);
          this.removeMessageByNick(username);
        });
        const resultArray = Array.from(validUsernames.values());
        const resultMessage =
          validUsernames.size === 1
            ? `Ignoring ${resultArray[0]}`
            : `Added the following people to your ignore list: ${resultArray.join(
                ', '
              )}`;
        MessageBuilder.status(resultMessage).into(this);
      }
    }
  }

  cmdUNIGNORE(parts: string[]) {
    if (parts.length > 0) {
      // see comment in cmdIGNORE for explanation
      const validUsernames = new Set<string>();
      const failure = parts.some((username) => {
        if (!nickregex.test(username)) {
          MessageBuilder.info(
            `${username} is not a valid nick - /unignore <nick> OR /unignore <nick_1> <nick_2> ... <nick_n>.`
          ).into(this);
          return true;
        }
        validUsernames.add(username);
        return false;
      });
      if (!failure) {
        validUsernames.forEach((username) => {
          this.ignore(username, false);
        });
        const haveOrHas = parts.length === 1 ? 'has' : 'have';
        MessageBuilder.status(
          `${Array.from(validUsernames.values()).join(
            ', '
          )} ${haveOrHas} been removed from your ignore list`
        ).into(this);
      }
    } else {
      MessageBuilder.error(
        'Invalid nick - /unignore <nick> OR /unignore <nick_1> <nick_2> ... <nick_n>'
      ).into(this);
    }
  }

  cmdUNIGNOREALL(parts: string[]) {
    const confirmation = parts[0] || null;
    if (
      !confirmation ||
      (confirmation.toLowerCase() !== 'yes' &&
        confirmation.toLowerCase() !== 'y')
    ) {
      MessageBuilder.error(
        'This command requires confirmation - /unignoreall yes OR /unignoreall y'
      ).into(this);
    } else {
      this.unignoreall();
      MessageBuilder.status(`Your ignore list has been cleared.`).into(this);
    }
  }

  cmdMUTE(parts: string[]) {
    if (parts.length === 0) {
      MessageBuilder.info(`Usage: /mute <nick> [<time>].`).into(this);
    } else if (!nickregex.test(parts[0])) {
      MessageBuilder.info(`Invalid nick - /mute <nick> [<time>].`).into(this);
    } else {
      const duration = parts[1] ? Chat.parseTimeInterval(parts[1]) : null;
      if (duration && duration > 0) {
        this.source.send('MUTE', { data: parts[0], duration });
      } else {
        this.source.send('MUTE', { data: parts[0] });
      }
    }
  }

  cmdBAN(parts: string[], command: string) {
    if (parts.length === 0 || parts.length < 3) {
      MessageBuilder.info(
        `Usage: /${command} <nick> <time> <reason> (time can be 'permanent').`
      ).into(this);
    } else if (!nickregex.test(parts[0])) {
      MessageBuilder.info('Invalid nick.').into(this);
    } else if (!parts[2]) {
      MessageBuilder.error('Providing a reason is mandatory.').into(this);
    } else {
      const payload: ChatWebsocketTypes.OUT.Ban = {
        nick: parts[0],
        reason: parts.slice(2, parts.length).join(' '),
      };
      if (/^perm/i.test(parts[1])) payload.ispermanent = true;
      else payload.duration = Chat.parseTimeInterval(parts[1]);

      payload.banip = command === 'IPBAN';

      this.source.send('BAN', payload);
    }
  }

  cmdUNBAN(parts: string[], command: string) {
    if (parts.length === 0) {
      MessageBuilder.info(`Usage: /${command} <nick>.`).into(this);
    } else if (!nickregex.test(parts[0])) {
      MessageBuilder.info('Invalid nick.').into(this);
    } else {
      this.source.send(command, { data: parts[0] });
    }
  }

  cmdSUBONLY(parts: string[], command: string) {
    if (/on|off/i.test(parts[0])) {
      this.source.send(command.toUpperCase(), { data: parts[0].toLowerCase() });
    } else {
      MessageBuilder.error(
        `Invalid argument - /${command.toLowerCase()} on | off`
      ).into(this);
    }
  }

  cmdMAXLINES(parts: string[], command: string) {
    if (parts.length === 0) {
      MessageBuilder.info(
        `Maximum lines stored: ${this.settings.get('maxlines')}.`
      ).into(this);
      return;
    }
    const newmaxlines = Math.abs(parseInt(parts[0], 10));
    if (!newmaxlines) {
      MessageBuilder.info(
        `Invalid argument - /${command} is expecting a number.`
      ).into(this);
    } else {
      this.settings.set('maxlines', newmaxlines);
      this.applySettings();
      MessageBuilder.info(`Set maximum lines to ${newmaxlines}.`).into(this);
    }
  }

  cmdHIGHLIGHT(parts: string[], command: string) {
    const highlights = this.settings.get('highlightnicks') as string[];
    if (parts.length === 0) {
      if (highlights.length > 0)
        MessageBuilder.info(
          `Currently highlighted users: ${highlights.join(',')}.`
        ).into(this);
      else MessageBuilder.info(`No highlighted users.`).into(this);
      return;
    }
    if (!nickregex.test(parts[0])) {
      MessageBuilder.error(`Invalid nick - /${command} nick`).into(this);
    }
    const nick = parts[0].toLowerCase();
    const i = highlights.indexOf(nick);
    switch (command) {
      case 'UNHIGHLIGHT':
        if (i !== -1) highlights.splice(i, 1);
        break;
      case 'HIGHLIGHT':
      default:
        if (i === -1) highlights.push(nick);
        break;
    }
    MessageBuilder.info(
      command.toUpperCase() === 'HIGHLIGHT'
        ? `Highlighting ${nick}.`
        : `No longer highlighting ${nick}.`
    ).into(this);
    this.settings.set('highlightnicks', highlights);
    this.applySettings();
  }

  cmdTIMESTAMPFORMAT(parts: string[]) {
    if (parts.length === 0) {
      MessageBuilder.info(
        `Current format: ${this.settings.get(
          'timestampformat'
        )} (the default is 'HH:mm', for more info: http://momentjs.com/docs/#/displaying/format/)`
      ).into(this);
    } else {
      const format = parts.join(' ');
      if (!/^[a-z :.,-\\*]+$/i.test(format)) {
        MessageBuilder.error(
          'Invalid format, see: http://momentjs.com/docs/#/displaying/format/'
        ).into(this);
      } else {
        this.settings.set('timestampformat', format);
        this.applySettings();
        MessageBuilder.info(`New format: ${format}.`).into(this);
      }
    }
  }

  cmdBROADCAST(parts: string[]) {
    this.source.send('BROADCAST', { data: parts.join(' ') });
  }

  cmdWHISPER(parts: string[]) {
    if (!parts[0] || !nickregex.test(parts[0])) {
      MessageBuilder.error('Invalid nick - /msg nick message').into(this);
    } else if (parts[0].toLowerCase() === this.user.username.toLowerCase()) {
      MessageBuilder.error('Cannot send a message to yourself').into(this);
    } else {
      const data = parts.slice(1, parts.length).join(' ');
      this.replyusername = parts[0];
      this.source.send('PRIVMSG', { nick: parts[0], data });
    }
  }

  cmdCONNECT(parts: string[]) {
    this.source.connect(parts[0]);
  }

  cmdTAG(parts: string[]) {
    if (parts.length === 0) {
      if (this.taggednicks.size > 0) {
        let tags = 'Tagged nicks\n\n';
        this.taggednicks.forEach((color, nick) => {
          const note = this.taggednotes.has(nick)
            ? this.taggednotes.get(nick)
            : '';
          tags += `    ${nick} (${color}) ${note}\n`;
        });
        MessageBuilder.info(`${tags}\n`).into(this);
      } else {
        MessageBuilder.info(`No tagged nicks.`).into(this);
      }
      MessageBuilder.info(
        `Usage. /tag <nick> [<color>, <note>]\n(Available colors: ${tagcolors.join(
          ', '
        )})`
      ).into(this);
      return;
    }
    if (!nickregex.test(parts[0])) {
      MessageBuilder.error('Invalid nick - /tag <nick> [<color>, <note>]').into(
        this
      );
      return;
    }
    const n = parts[0].toLowerCase();
    if (n === this.user.username.toLowerCase()) {
      MessageBuilder.error('Cannot tag yourself').into(this);
      return;
    }
    if (!this.users.has(n)) {
      MessageBuilder.error('User must be present in chat to tag.').into(this);
      return;
    }

    let color = '';
    let note = '';
    if (parts[1]) {
      if (tagcolors.indexOf(parts[1]) !== -1) {
        color = parts[1];
        note = parts[2] ? parts.slice(2, parts.length).join(' ') : '';
      } else {
        color = tagcolors[Math.floor(Math.random() * tagcolors.length)];
        note = parts[1] ? parts.slice(1, parts.length).join(' ') : '';
      }
      if (note.length > 100) {
        note = note.substr(0, 100);
      }
    } else {
      color = tagcolors[Math.floor(Math.random() * tagcolors.length)];
    }

    (this.mainwindow as ChatWindow)
      .getlines(`.msg-user[data-username="${n}"]`)
      .forEach((line) => {
        const classesToRemove = Chat.removeClasses(
          'msg-tagged',
          line.classList.value
        );
        classesToRemove.forEach((className) =>
          line.classList.remove(className)
        );
        ['msg-tagged', `msg-tagged-${color}`].forEach((tag) =>
          line.classList.add(tag)
        );
        (line.querySelector('.user') as HTMLDivElement).title = note;
      });

    this.taggednicks.set(n, color);
    this.taggednotes.set(n, note);
    this.settings.set('taggednicks', [...this.taggednicks]);
    this.settings.set('taggednotes', [...this.taggednotes]);
    this.applySettings();
    MessageBuilder.info(`Tagged ${parts[0]} as ${color}.`).into(this);
  }

  cmdUNTAG(parts: string[]) {
    if (parts.length === 0) {
      if (this.taggednicks.size > 0) {
        let tags = 'Tagged nicks\n\n';
        this.taggednicks.forEach((color, nick) => {
          const note = this.taggednotes.has(nick)
            ? this.taggednotes.get(nick)
            : '';
          tags += `    ${nick} (${color}) ${note}\n`;
        });
        MessageBuilder.info(`${tags}\n`).into(this);
      } else {
        MessageBuilder.info(`No tagged nicks.`).into(this);
      }
      MessageBuilder.info(`Usage. /untag <nick>`).into(this);
      return;
    }
    if (!nickregex.test(parts[0])) {
      MessageBuilder.error(
        'Invalid nick - /untag <nick> [<color>, <note>]'
      ).into(this);
      return;
    }
    const n = parts[0].toLowerCase();

    (this.mainwindow as ChatWindow)
      .getlines(`.msg-user[data-username="${n}"]`)
      .forEach((line) => {
        const classesToRemove = Chat.removeClasses(
          'msg-tagged',
          line.classList.value
        );
        classesToRemove.forEach((className) =>
          line.classList.remove(className)
        );
        (line.querySelector('.user') as HTMLDivElement).removeAttribute(
          'title'
        );
      });

    this.taggednicks.delete(n);
    this.taggednotes.delete(n);
    this.settings.set('taggednicks', [...this.taggednicks]);
    this.settings.set('taggednotes', [...this.taggednotes]);
    this.applySettings();
    MessageBuilder.info(`Un-tagged ${n}.`).into(this);
  }

  cmdEMBED(parts: string[]) {
    const { location } = window.top || window.parent || window;
    try {
      location.hash = this.hashLinkConverter.convert(parts[0]);
    } catch (error: unknown) {
      MessageBuilder.error((error as Error).message).into(this);
      MessageBuilder.info(
        'Usage: /embed <link> OR /e <link> (Valid links: Twitch streams, VODs, clips, Youtube, Rumble)'
      ).into(this);
    }
  }

  cmdPOSTEMBED(parts: string[]) {
    const { location } = window.top || window.parent || window;
    try {
      const hashLink = this.hashLinkConverter.convert(parts[0]);
      this.source.send('MSG', {
        data: `${hashLink} ${parts.slice(1).join(' ')}`,
      });
    } catch (error) {
      if (location.hash) {
        this.source.send('MSG', {
          data: `${location.hash} ${parts.join(' ')}`,
        });
      } else {
        if ((error as Error).message === MISSING_ARG_ERROR) {
          MessageBuilder.error('Nothing embedded').into(this);
        } else {
          MessageBuilder.error((error as Error).message).into(this);
        }
        MessageBuilder.info(
          'Usage: /postembed [<link>] [<message>] (Alias: /pe) (Valid links: Twitch streams, VODs, clips, Youtube, Rumble)'
        ).into(this);
      }
    }
  }

  cmdBANINFO() {
    MessageBuilder.info('Loading ban info ...').into(this);
    fetch(`${this.config.api.base}/api/chat/me/ban`, { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => {
        if (data === 'bannotfound') {
          MessageBuilder.info(`You have no active bans. Thank you.`).into(this);
          return;
        }
        const b = { ...banstruct, ...data };
        const by = b.username ? b.username : 'Chat';
        const start = moment
          .utc(b.starttimestamp)
          .local()
          .format(DATE_FORMATS.FULL);
        if (!b.endtimestamp) {
          MessageBuilder.info(
            `Permanent ban by ${by} started on ${start}.`
          ).into(this);
        } else {
          const end = moment.utc(b.endtimestamp).local().calendar();
          MessageBuilder.info(
            `Temporary ban by ${by} started on ${start} and ending by ${end}.`
          ).into(this);
        }
        if (b.reason) {
          const m = MessageBuilder.message(
            b.reason,
            new ChatUser(by),
            b.starttimestamp
          );
          m.historical = true;
          m.into(this);
        }
        MessageBuilder.info(`End of ban information.`).into(this);
      })
      .catch(() =>
        MessageBuilder.error(
          'Error loading ban info. Check your profile.'
        ).into(this)
      );
  }

  cmdOPEN(parts: string[]) {
    if (!parts[0]) {
      MessageBuilder.error(
        'No username specified - /open <username> OR /o <username>'
      ).into(this);
    } else if (parts.length > 1) {
      MessageBuilder.error(
        'Too many arguments provided - /open <username> OR /o <username>'
      ).into(this);
    } else if (parts[0] !== this.user.username) {
      const normalized = parts[0].toLowerCase();
      const win = this.getWindow(normalized);
      if (win !== (null || undefined)) {
        this.windowToFront(normalized);
      } else {
        if (!this.whispers.has(normalized)) {
          const whisper: ChatWhisper = {
            id: 'null',
            nick: normalized,
            unread: 0,
            open: false,
          };
          this.whispers.set(normalized, whisper);
        }
        this.openConversation(normalized);
      }
    } else {
      MessageBuilder.error(
        "Can't open a convo with yourself - /open <username> OR /o <username>"
      ).into(this);
    }
  }

  cmdEXIT() {
    const win = this.getActiveWindow();
    if (win !== this.mainwindow) {
      this.windowToFront((this.mainwindow as ChatWindow).name);
      this.removeWindow(win.name);
    }
  }

  cmdREPLY() {
    const win = this.getActiveWindow();
    const lastuser =
      (win.lastmessage as ChatUserMessage) &&
      (win.lastmessage as ChatUserMessage).user
        ? (win.lastmessage as ChatUserMessage).user.username
        : null;
    const username =
      this.replyusername !== null && this.replyusername !== ''
        ? this.replyusername
        : lastuser;
    if (username === null) {
      MessageBuilder.info(`No one to reply to. :(`).into(this);
    } else {
      (this.input as JQuery).val(`/w ${username} `);
    }
    (this.input as JQuery).trigger('focus');
  }

  cmdSTALK(parts: string[]) {
    if (!this.config.stalkEnabled) {
      MessageBuilder.error('The `/stalk` command is disabled.').into(this);
      return;
    }

    if (parts[0] && /^\d+$/.test(parts[0])) {
      parts[1] = parts[0];
      parts[0] = this.user.username;
    }
    if (!parts[0] || !nickregex.test(parts[0].toLowerCase())) {
      MessageBuilder.error('Invalid nick - /stalk <nick> <limit>').into(this);
      return;
    }
    if (this.busystalk) {
      MessageBuilder.error(`Still busy stalking ${[parts[0]]} ...`).into(this);
      return;
    }
    if (this.nextallowedstalk && this.nextallowedstalk.isAfter(new Date())) {
      MessageBuilder.error(
        `Next allowed stalk ${this.nextallowedstalk.fromNow()}`
      ).into(this);
      return;
    }
    this.busystalk = true;
    const limit = parts[1] ? parseInt(parts[1], 10) : 3;
    MessageBuilder.info(`Getting messages from ${[parts[0]]} ...`).into(this);

    fetch(
      `${this.config.api.base}/api/chat/stalk?username=${encodeURIComponent(
        parts[0]
      )}&limit=${limit}`,
      { credentials: 'include' }
    )
      .then((res) => res.json())
      .then((d: WebsiteApiTypes.Stalk) => {
        if (!d || !d.lines || d.lines.length === 0) {
          MessageBuilder.info(`No messages from ${parts[0]}.`).into(this);
        } else {
          const date = moment
            .utc(d.lines[d.lines.length - 1].timestamp * 1000)
            .local()
            .format(DATE_FORMATS.FULL);
          MessageBuilder.info(`Stalked ${parts[0]} last seen ${date}.`).into(
            this
          );
          d.lines.forEach((a) =>
            MessageBuilder.historical(
              a.text,
              new ChatUser(d.nick),
              a.timestamp * 1000
            ).into(this)
          );
        }
      })
      .catch(() =>
        MessageBuilder.error(
          `No messages from ${parts[0]} received. Try again later.`
        ).into(this)
      )
      .then(() => {
        this.nextallowedstalk = moment().add(10, 'seconds');
        this.busystalk = false;
      });
  }

  cmdMENTIONS(parts: string[]) {
    if (!this.config.mentionsEnabled) {
      MessageBuilder.error('The `/mentions` command is disabled.').into(this);
      return;
    }

    if (parts[0] && /^\d+$/.test(parts[0])) {
      parts[1] = parts[0];
      parts[0] = this.user.username;
    }
    if (!parts[0]) parts[0] = this.user.username;
    if (!parts[0] || !nickregex.test(parts[0].toLowerCase())) {
      MessageBuilder.error('Invalid nick - /mentions <nick> <limit>').into(
        this
      );
      return;
    }
    if (this.busymentions) {
      MessageBuilder.error(`Still busy getting ${[parts[0]]}'s mentions`).into(
        this
      );
      return;
    }
    if (
      this.nextallowedmentions &&
      this.nextallowedmentions.isAfter(new Date())
    ) {
      MessageBuilder.error(
        `Next allowed mentions ${this.nextallowedmentions.fromNow()}`
      ).into(this);
      return;
    }
    this.busymentions = true;
    const limit = parts[1] ? parseInt(parts[1], 10) : 3;
    MessageBuilder.info(`Getting mentions for ${[parts[0]]} ...`).into(this);
    fetch(
      `${this.config.api.base}/api/chat/mentions?username=${encodeURIComponent(
        parts[0]
      )}&limit=${limit}`,
      { credentials: 'include' }
    )
      .then((res) => res.json())
      .then((d: WebsiteApiTypes.Mention[]) => {
        if (!d || d.length === 0) {
          MessageBuilder.info(`No mentions for ${parts[0]}.`).into(this);
        } else {
          const date = moment
            .utc(d[d.length - 1].date * 1000)
            .local()
            .format(DATE_FORMATS.FULL);
          MessageBuilder.info(
            `Mentions for ${parts[0]} last seen ${date}.`
          ).into(this);
          d.forEach((a) =>
            MessageBuilder.historical(
              a.text,
              new ChatUser(a.nick),
              a.date * 1000
            ).into(this)
          );
        }
      })
      .catch(() =>
        MessageBuilder.error(
          `No mentions for ${parts[0]} received. Try again later.`
        ).into(this)
      )
      .then(() => {
        this.nextallowedmentions = moment().add(10, 'seconds');
        this.busymentions = false;
      });
  }

  cmdHOST(parts: string[]) {
    const displayName = parts[1];
    let url = parts[0];

    if (!this.user.hasAnyFeatures(UserFeatures.ADMIN, UserFeatures.MODERATOR)) {
      MessageBuilder.error(errorstrings.get('nopermission') as string).into(
        this
      );
      return;
    }

    if (!url) {
      MessageBuilder.error(
        'No argument provided - /host <url> <displayName optional>'
      ).into(this);
      return;
    }

    try {
      // new URL() will throw an invalid error if the provided url
      // does not start with http(s)//.
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = `https://${url}`;
      }

      new URL(url); // eslint-disable-line no-new
    } catch (e) {
      MessageBuilder.error(
        'Invalid url - /host <url> <displayName optional>'
      ).into(this);
      return;
    }

    fetch(`${this.config.api.base}/api/stream/host`, {
      body: JSON.stringify({ url, displayName }),
      credentials: 'include',
      method: 'POST',
      headers: { 'X-CSRF-Guard': 'YEE' },
    })
      .then((res) => res.json())
      .then((data) => {
        if (!data.success) {
          MessageBuilder.error(data.message).into(this);
        }
      });
  }

  cmdUNHOST() {
    if (!this.user.hasAnyFeatures(UserFeatures.ADMIN, UserFeatures.MODERATOR)) {
      MessageBuilder.error(errorstrings.get('nopermission') as string).into(
        this
      );
      return;
    }

    fetch(`${this.config.api.base}/api/stream/unhost`, {
      credentials: 'include',
      method: 'POST',
      headers: { 'X-CSRF-Guard': 'YEE' },
    })
      .then((res) => res.json())
      .then((data) => {
        if (!data.success) {
          MessageBuilder.error(data.message).into(this);
        }
      });
  }

  cmdPIN(parts: string[]) {
    if (!parts.length) {
      MessageBuilder.error('No message provided - /pin <message>').into(this);
      return;
    }
    this.source.send('PIN', { data: parts.join(' ') });
  }

  cmdUNPIN() {
    this.source.send('PIN', { data: '' });
  }

  openConversation(nick: string) {
    const normalized = nick.toLowerCase();
    const conv = this.whispers.get(normalized);
    if (conv) {
      ChatMenu.closeMenus(this);
      if (!this.windows.has(normalized)) {
        this.createConversation(conv, nick, normalized);
      }
      this.windowToFront(normalized);
      (this.menus.get('whisper-users') as ChatWhisperUsers).redraw();
      (this.input as JQuery).trigger('focus');
    }
  }

  createConversation(conv: ChatWhisper, nick: string, normalized: string) {
    const user = this.users.get(normalized) || new ChatUser(nick);
    const win = new ChatWindow(
      normalized,
      'chat-output-whisper',
      user.nick
    ).into(this);
    let once = true;
    win.on('show', () => {
      if (once) {
        once = false;
        MessageBuilder.info(`Messages between you and ${nick}`).into(this, win);
        fetch(
          `${this.config.api.base}/api/messages/usr/${encodeURIComponent(
            user.nick
          )}/inbox`,
          { credentials: 'include' }
        )
          .then((res) => res.json())
          .then((data: WebsiteApiTypes.WhisperMessage[]) => {
            if (data.length > 0) {
              const date = moment(data[0].timestamp).format(DATE_FORMATS.FULL);
              MessageBuilder.info(`Last message ${date}.`).into(this, win);
              data.reverse().forEach((e) => {
                const inboxUser =
                  this.users.get(e.from.toLowerCase()) || new ChatUser(e.from);
                MessageBuilder.historical(
                  e.message,
                  inboxUser,
                  parseInt(e.timestamp, 10)
                ).into(this, win);
              });
            }
          })
          .catch(() =>
            MessageBuilder.error(`Failed to load messages :(`).into(this, win)
          );
      } else if (conv.unread > 0) {
        fetch(
          `${this.config.api.base}/api/messages/usr/${encodeURIComponent(
            normalized
          )}/inbox`,
          { credentials: 'include' }
        ).catch(() =>
          MessageBuilder.error(`Failed to mark messages as read :(`).into(
            this,
            win
          )
        );
      }
      conv.unread = 0;
      conv.open = true;
    });
    win.on('hide', () => {
      conv.open = false;
    });
  }

  static removeSlashCmdFromText(msg: string) {
    return msg.replace(regexslashcmd, '').trim();
  }

  static extractNicks(text: string) {
    const uniqueNicks = new Set(text.match(nickmessageregex));
    return [...uniqueNicks];
  }

  static removeClasses(search: string, classList: string) {
    return (
      classList.match(new RegExp(`\\b${search}(?:[A-z-]+)?\\b`, 'g')) || []
    );
  }

  static isArraysEqual(a: unknown[], b: unknown[]) {
    return !a || !b
      ? a.length !== b.length || a.sort().toString() !== b.sort().toString()
      : false;
  }

  static showNotification(
    title: string,
    message: string,
    timestamp: number,
    timeout = false
  ) {
    if (Notification.permission === 'granted') {
      const n = new Notification(title, {
        body: message,
        tag: `dgg${timestamp}`,
        icon: '/notifyicon.png?v2',
        dir: 'auto',
      });
      if (timeout) setTimeout(() => n.close(), 8000);
    }
  }

  static parseTimeInterval(str: string) {
    let nanoseconds = 0;
    const units = {
      s: 1000000000,
      sec: 1000000000,
      secs: 1000000000,
      second: 1000000000,
      seconds: 1000000000,

      m: 60000000000,
      min: 60000000000,
      mins: 60000000000,
      minute: 60000000000,
      minutes: 60000000000,

      h: 3600000000000,
      hr: 3600000000000,
      hrs: 3600000000000,
      hour: 3600000000000,
      hours: 3600000000000,

      d: 86400000000000,
      day: 86400000000000,
      days: 86400000000000,
    };
    str.replace(regextime, ($0: string, number: number, unit: string) => {
      const addNs =
        number *
        (unit
          ? units[unit.toLowerCase() as keyof typeof units] ?? units.s
          : units.s);
      nanoseconds += addNs;
      return '';
    });
    return nanoseconds;
  }

  static loadCss(url: string) {
    const link = document.createElement('link');
    link.href = url;
    link.type = 'text/css';
    link.rel = 'stylesheet';
    link.media = 'screen';
    document.getElementsByTagName('head')[0].appendChild(link);
    return link;
  }

  static reqParam(name: string) {
    const sanitizedName = name.replace(/[[\]]/g, '\\$&');
    const url = window.location ? window.location.href : '';
    const regex = new RegExp(`[?&]${sanitizedName}(=([^&#]*)|&|#|$)`);
    const results = regex.exec(url);
    if (!results || !results[2]) return null;
    return decodeURIComponent(results[2].replace(/\+/g, ' '));
  }

  static extractHostname(url: string) {
    let hostname =
      url.indexOf('://') > -1 ? url.split('/')[2] : url.split('/')[0];
    hostname = hostname.split(':')[0];
    hostname = hostname.split('?')[0];
    return hostname;
  }
}

export default Chat;
