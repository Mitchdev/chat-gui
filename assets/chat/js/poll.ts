import $ from 'jquery';
import { throttle } from 'throttle-debounce';
import Chat from './chat';
import UserFeatures from './features';
import { MessageBuilder } from './messages';
import { ChatWebsocketTypes, Poll } from './types';
import { PollType } from './types/Poll';
import ChatUser from './user';
import ChatWindow from './window';

const POLL_CONJUNCTION = /\bor\b/i;
const POLL_INTERROGATIVE = /^(how|why|when|what|where)\b/i;
const POLL_TIME = /\b([0-9]+(?:m|s))$/i;
const POLL_DEFAULT_TIME = 30000;
const POLL_MAX_TIME = 10 * 60 * 1000;
const POLL_MIN_TIME = 5000;
const POLL_END_TIME = 7000;

function parseQuestion(msg: string) {
  if (msg.indexOf('?') === -1) {
    throw new Error('Must contain a ?');
  }
  const parts = msg.split('?');
  const question = `${parts[0]}?`;
  if (parts[1].trim() !== '') {
    const options = parts[1].split(POLL_CONJUNCTION).map((a) => a.trim());
    if (options.length < 2 && question.match(POLL_INTERROGATIVE)) {
      throw new Error('question needs at least 2 available answers');
    }
    return { question, options };
  }
  return { question, options: ['Yes', 'No'] };
}

function parseQuestionAndTime(rawQuestion: string) {
  let questionTime;
  const match = rawQuestion.match(POLL_TIME);
  if (match && match[0]) {
    switch (match[0].replace(/[0-9]+/, '').toLowerCase()) {
      case 's':
        questionTime = parseInt(match[0], 10) * 1000;
        break;
      case 'm':
        questionTime = parseInt(match[0], 10) * 60 * 1000;
        break;
      default:
        questionTime = POLL_DEFAULT_TIME;
        break;
    }
  } else {
    questionTime = POLL_DEFAULT_TIME;
  }

  const question = parseQuestion(rawQuestion.replace(POLL_TIME, '').trim());
  const time = Math.max(POLL_MIN_TIME, Math.min(questionTime, POLL_MAX_TIME));

  return { time, ...question };
}

class ChatPoll {
  chat: Chat;
  ui: JQuery & {
    title: JQuery;
    votes: JQuery;
    question: JQuery;
    options: JQuery;
    timer: JQuery;
    endmsg: JQuery;
  };

  poll: Poll | null;
  voting: boolean;
  hidden: boolean;
  timerHidePoll: NodeJS.Timeout | null;

  throttleVoteCast: throttle<() => void>;

  constructor(chat: Chat) {
    this.chat = chat;
    this.ui = (this.chat.ui as JQuery).find('#chat-poll-frame') as JQuery & {
      title: JQuery;
      votes: JQuery;
      question: JQuery;
      options: JQuery;
      timer: JQuery;
      endmsg: JQuery;
    };
    this.ui.title = this.ui.find('.poll-info') as JQuery;
    this.ui.votes = this.ui.find('.poll-votes') as JQuery;
    this.ui.question = this.ui.find('.poll-question') as JQuery;
    this.ui.options = this.ui.find('.poll-options') as JQuery;
    this.ui.timer = this.ui.find('.poll-timer-inner') as JQuery;
    this.ui.endmsg = this.ui.find('.poll-end') as JQuery;
    this.poll = null;
    this.voting = false;
    this.hidden = true;
    this.timerHidePoll = null;
    this.ui.on('click touch', '.poll-close', () => this.hide());
    this.ui.on('click touch', '.opt', (e) => {
      if (this.voting) {
        if ((this.poll as Poll).canVote) {
          this.chat.source.send('CASTVOTE', {
            vote: `${$(e.currentTarget).index() + 1}`,
          });
        } else {
          MessageBuilder.error(`You have already voted!`).into(this.chat);
        }
      }
    });
    this.throttleVoteCast = throttle(100, () => {
      this.updateBars();
    });
  }

  hide() {
    if (!this.hidden) {
      this.hidden = true;
      this.ui.removeClass('active');
      (this.chat.mainwindow as ChatWindow).update();
    }
  }

  show() {
    if (this.hidden) {
      this.hidden = false;
      this.ui.addClass('active');
      (this.chat.mainwindow as ChatWindow).update();
    }
  }

  isPollStarted() {
    return this.voting;
  }

  hasPermission(user: ChatUser) {
    return user.hasAnyFeatures(
      UserFeatures.ADMIN,
      UserFeatures.BOT,
      UserFeatures.MODERATOR
    );
  }

  isMsgVoteCastFmt(txt: string) {
    if (txt.match(/^[0-9]+$/i)) {
      const int = parseInt(txt, 10);
      return int > 0 && int <= (this.poll as Poll).options.length;
    }
    return false;
  }

  castVote(data: ChatWebsocketTypes.IN.VoteCast, user: ChatUser) {
    const votes = this.votesForUser(user);
    (this.poll as Poll).totals[parseInt(data.vote, 10) - 1] += votes;
    (this.poll as Poll).votesCast += votes;
    this.throttleVoteCast();
  }

  votesForUser(user: ChatUser) {
    switch ((this.poll as Poll).type) {
      case PollType.Weighted:
        if (user.hasFeature(UserFeatures.SUB_TIER_5)) return 32;
        if (user.hasFeature(UserFeatures.SUB_TIER_4)) return 16;
        if (user.hasFeature(UserFeatures.SUB_TIER_3)) return 8;
        if (user.hasFeature(UserFeatures.SUB_TIER_2)) return 4;
        if (user.hasFeature(UserFeatures.SUB_TIER_1)) return 2;
        return 1;
      case PollType.Normal:
      default:
        return 1;
    }
  }

  startPoll(data: ChatWebsocketTypes.IN.PollStart) {
    this.voting = true;
    clearTimeout(this.timerHidePoll as NodeJS.Timeout);

    this.poll = {
      canVote: data.canvote,
      myVote: data.myvote,
      type: data.weighted ? PollType.Weighted : PollType.Normal,
      start: new Date(data.start),
      offset: new Date(data.now).getTime() - new Date().getTime(),
      time: data.time,
      question: data.question,
      options: data.options,
      totals: data.totals,
      user: data.nick,
      votesCast: data.totalvotes,
    };

    this.reset();
    this.ui.title.text(
      `${
        this.poll.type === PollType.Weighted ? 'Sub-weighted poll' : 'Poll'
      } started by ${this.poll.user} for ${Math.floor(
        this.poll.time / 1000
      )} seconds.`
    );
    this.ui.question.text(this.poll.question);
    this.ui.options.html(
      this.poll.options
        .map(
          (option, i) => `
        <div class="opt" title="Vote ${option}">
          <div class="opt-info">
            <span class="opt-vote-number">
              <strong>${i + 1}</strong>
            </span>
            <span class="opt-bar-option">${option}</span>
            <span class="opt-bar-value"></span>
          </div>
          <div class="opt-bar">
            <div class="opt-bar-inner" style="width: 0;"></div>
          </div>
        </div>
      `
        )
        .join('')
    );

    this.pollStartMessage();
    this.updateTimer();
    this.updateBars();

    if (this.poll.myVote !== 0) {
      this.markVote(this.poll.myVote);
    }

    this.show();
  }

  reset() {
    this.ui.removeClass('poll-completed');
    this.ui.timer.css('transition', `none`);
    this.ui.timer.css('width', `100%`);
    this.ui.endmsg.hide();
    this.ui.timer.parent().show();
  }

  endPoll() {
    this.voting = false;
    clearTimeout(this.timerHidePoll as NodeJS.Timeout);
    this.markWinner();
    this.ui.timer.parent().hide();
    this.ui.endmsg
      .text(`Poll ended! ${(this.poll as Poll).votesCast} votes cast.`)
      .show();
    this.ui.addClass('poll-completed');
    this.timerHidePoll = setTimeout(() => this.hide(), POLL_END_TIME);
  }

  markWinner() {
    $('.opt-winner').removeClass('opt-winner');

    const winnerIndex = (this.poll as Poll).totals.reduce(
      (max, x, i, arr) => (x > arr[max] ? i : max),
      0
    );

    this.ui.options.children().eq(winnerIndex).addClass('opt-winner');

    this.pollEndMessage(
      winnerIndex + 1,
      this.ui.options.children().eq(winnerIndex).data('percentage')
    );
  }

  markVote(opt: number) {
    (this.poll as Poll).canVote = false;
    this.ui.options
      .children()
      .eq(opt - 1)
      .addClass('opt-marked');
  }

  updateTimer() {
    let remaining =
      (this.poll as Poll).time -
      (new Date().getTime() +
        (this.poll as Poll).offset -
        (this.poll as Poll).start.getTime());
    remaining = Math.max(
      0,
      Math.floor(Math.min(remaining, (this.poll as Poll).time))
    );
    const percentage = Math.max(
      0,
      (remaining / (this.poll as Poll).time) * 100 - 1
    );
    this.ui.timer.css('width', `${percentage}%`);
    this.ui.timer.css('transition', `width ${remaining - 1}ms linear`);
    setTimeout(() => this.ui.timer.css('width', '0%'), 1);
  }

  updateBars() {
    if (this.voting) {
      (this.poll as Poll).options.forEach((_, i) => {
        const percent =
          (this.poll as Poll).votesCast > 0
            ? ((this.poll as Poll).totals[i] / (this.poll as Poll).votesCast) *
              100
            : 0;

        this.ui.options.children().eq(i).attr('data-percentage', `${percent}`);

        this.ui.options
          .children()
          .eq(i)
          .find('.opt-bar-inner')
          .css('width', `${percent}%`);

        this.ui.options
          .children()
          .eq(i)
          .find('.opt-bar-value')
          .text(
            `${Math.round(percent)}% (${(this.poll as Poll).totals[i]} votes)`
          );
      });
    }

    this.ui.votes.text(`${(this.poll as Poll).votesCast} votes`);
  }

  pollStartMessage() {
    let message = `A poll has been started. Type ${(this.poll as Poll).totals
      .map((_, i) => i + 1)
      .join(' or ')} in chat to participate.`;
    if ((this.poll as Poll).type === PollType.Weighted) {
      message = `A sub-weighted poll has been started. The value of your vote depends on your subscription tier. Type ${(
        this.poll as Poll
      ).totals
        .map((_, i) => i + 1)
        .join(' or ')} in chat to participate.`;
    }

    MessageBuilder.info(message).into(this.chat);
  }

  pollEndMessage(winner: number, winnerPercentage: number) {
    let message = `The poll has ended. Option ${winner} won!`;
    if (winnerPercentage > 0) {
      message = `The poll has ended. Option ${winner} won with ${Math.round(
        winnerPercentage
      )}% of the vote.`;
    }

    MessageBuilder.info(message).into(this.chat);
  }
}

export { ChatPoll, parseQuestionAndTime };
