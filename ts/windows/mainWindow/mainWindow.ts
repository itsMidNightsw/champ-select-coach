import { windowNames } from "../../ts-lib/consts";
import * as $ from "jquery"; //npm install --save-dev @types/jquery
import { Timer } from "../../ts-lib/timer";
import { OWWindow } from "../../ts-lib/ow-window";
import { CsTab } from "../../ts-lib/csTab";
import { PersonalTab } from "../../ts-lib/personalTab";
import { Logger } from "../../ts-lib/logger";
import { CSCAI } from "../../ts-lib/cscai";
import { Popup } from "../../ts-lib/popup";
import { Subscriptions } from "../../ts-lib/subscriptions";
import { PatchNotes } from "../../ts-lib/patchNotes";
import { Lcu } from "../../ts-lib/lcu";
import { Aws } from "../../ts-lib/aws";
import { DynamicSettings } from "../../ts-lib/dynamicSettings";


declare var _owAdConstructor: any;
// declare var _owAd: any;
// declare var _owAdReady: any;

export class MainWindow {
  private static _instance: MainWindow;
  protected window: OWWindow;

  private csTab: CsTab;
  private personalTab: PersonalTab;
  private selectedView: string = '';
  private dynamicSettings: DynamicSettings;
  private static lastStatusPopup: string = null;

  public patchInfo: any;
  private ongoingFeedback: boolean = false;

  public static MAX_MENU_HISTORY_SIZE: number = 13;

  public static instance() {
    return this._instance = this._instance || new MainWindow();
  }

  public run() {}

  constructor() {
    Logger.log("MainWindow begin");

    this.window = new OWWindow(windowNames.mainWindow);

    //Track window state to pause/resume ads
    overwolf.windows.onStateChanged.removeListener(x => MainWindow.handleStateChanged(x));
    overwolf.windows.onStateChanged.addListener(x => MainWindow.handleStateChanged(x));

    this.initWindow();
  }

  public async initWindow() {
    this.patchInfo = await CSCAI.getPatchInfo();
    await this.loadHTML();
    await this.setCallbacks();
    this.csTab = new CsTab(this.patchInfo);
    this.personalTab = new PersonalTab(this.patchInfo);
    this.dynamicSettings = new DynamicSettings(MainWindow.setStatus);
    MainWindow.waitForAdsLibToLoadThenInitAdObj();

    Popup.prompt('Subscription', 'Do you want to temporarily enable the subscribed only mode?', () => Subscriptions.TODO = true, () => {});
  }


  private static lastAdRefresh: number = 0;
  private static owAdObj: any = null;
  private static owAdObjReady: boolean = false;
  private static async waitForAdsLibToLoadThenInitAdObj() {
    while(!_owAdConstructor) await Timer.wait(1000);

    MainWindow.owAdObj = new _owAdConstructor(document.getElementById("owad"), {size: {width: 400, height: 300}});
    MainWindow.owAdObj.addEventListener('ow_internal_rendered', () => {
      // It is now safe to call any API you want ( e.g. MainWindow.owAdObj.refreshAd() or MainWindow.owAdObj.removeAd() )
      MainWindow.owAdObjReady = true;
      MainWindow.activity();
    });
  }

  public static async handleStateChanged(state: any) {
    if (state && state.window_name == windowNames.mainWindow) {
      if (!MainWindow.owAdObjReady){
        await Timer.wait(1000);
        let maxTries = 20;
        while(!MainWindow.owAdObjReady && --maxTries > 0){
          await Timer.wait(1000);
        }
        if (maxTries == 0) return;
      }

      if (await Subscriptions.isSubscribed()) {
        MainWindow.owAdObj.removeAd(); //No ads for subscribed
        return;
      }
      if (state.window_state === "minimized") {
        MainWindow.owAdObj.removeAd();
      }
      else if(state.window_previous_state === "minimized" && state.window_state === "normal"){
        if (!await Subscriptions.isSubscribed()) {
          MainWindow.lastAdRefresh = new Date().getTime();
          MainWindow.owAdObj.refreshAd();
        }
      }
    }
  }

  private static lastActivity: number = 0;
  public static async activity() {
    if (new Date().getTime() - MainWindow.lastActivity < 1000) {
      return; //Prevent spamming of this function
    }
    MainWindow.lastActivity = new Date().getTime();
    if (await Subscriptions.isSubscribed()) {
      MainWindow.owAdObj.removeAd();
      $('.side-menu-add-manual-cs').show();
    } else {
      $('.side-menu-add-manual-cs').hide();
    }

    if (new Date().getTime() - MainWindow.lastAdRefresh > 1000 * 60 * 10) {
      await Timer.wait(1000);
      if (new Date().getTime() - MainWindow.lastAdRefresh > 1000 * 60 * 10) {
        //Refresh AD if user comes back from being idle, but after 1 second of this happening
        if (MainWindow.owAdObjReady && !await Subscriptions.isSubscribed()) {
          MainWindow.lastAdRefresh = new Date().getTime();
          MainWindow.owAdObj.refreshAd();
        }
      }
    }

  }

  public repositionOverflowingPopup(elmn: any) {
    const bodyHeight = $('body').height();
    const bodyWidth = $('body').width();
    for (let tt of $(elmn).find('.tooltiptext')) {
      const currPos = $(tt).offset();
      const currTrans = $(tt).css('transform');
      let currTx = 0;
      let currTy = 0;
      if (currTrans && currTrans != 'none') {
        const arr = $(tt).css('transform').split('(')[1].split(')')[0].split(', ').map(x => parseFloat(x));
        currTx = arr[4];
        currTy = arr[5];
      }

      const offsetX = $(tt).outerWidth() + currPos.left - currTx - (bodyWidth - 2);
      const offsetY = $(tt).outerHeight() + currPos.top - currTy - (bodyHeight - 2);
      const newTx = Math.min(0, -Math.round(offsetX));
      const newTy = Math.min(0, -Math.round(offsetY));

      if (currTx != newTx || currTy != newTy) {
        $(tt).css('transform', 'translate(' + newTx + 'px, ' + newTy + 'px)');
      }
    }
  }

  private async loadHTML() {
    // Note, load everything but hide it, this is more efficient than having to reload every time

    //Side menu
    $('.side-menu').append(await (await fetch('sideMenu.html')).text());
    for (let i = 0; i < MainWindow.MAX_MENU_HISTORY_SIZE; ++i) {
      $('#side-menu-old-cs-list').append(await (await fetch('sideMenuOption.html')).text());
    }

    //Popups
    $('.faq-tab').append(await (await fetch('faqTab.html')).text());
    $('.settings-tab').append(await (await fetch('settingsTab.html')).text());
    $('.feedback-tab').append(await (await fetch('feedbackTab.html')).text());
    $('.news-tab').append(await (await fetch('newsTab.html')).text());

    const patchNotesHtml = $('.slide-overlay-news .accordeon-row').prop('outerHTML');
    const patchNotesContent = PatchNotes.get();
    for (let i = 0; i < Math.min(9, patchNotesContent.length - 1); ++i) {
      $('.slide-overlay-news .slide-overlay-content').prepend(patchNotesHtml);
    }
    const patchNotesIdElems = $('.patch-notes-version-id').get();
    const patchNotesTitleElems = $('.patch-notes-short-title').get();
    const patchNotesDateElems = $('.patch-notes-date').get();
    const patchNotesDescElems = $('.slide-overlay-news .accordeon-row li').get();
    for (let i = 0; i < Math.min(10, patchNotesContent.length); ++i) {
      const p = patchNotesContent[patchNotesContent.length - 1 - i];
      $(patchNotesIdElems[i]).html(<string>p[0]);
      $(patchNotesTitleElems[i]).html(<string>p[2]);
      $(patchNotesDateElems[i]).html(<string>p[1]);
      for (let x of p[3]) {
        $(patchNotesDescElems[i]).append('• ' + x + '<br/>');
      }
    }

    $('.submitFeedback').on('click', async () => {
      if (this.ongoingFeedback) return;
      this.ongoingFeedback = true;
      try {
        await this.submitFeedback();
      } finally {
        this.ongoingFeedback = false;
      }
    });

    //Personal
    $('.personal-tab').append(await (await fetch('personalTab.html')).text());
    for (let i = 0; i < 4; ++i) {
      $('.personal-champions-list').append(await (await fetch('personalTabChampionItem.html')).text());
    }

    for (let i = 0; i < 10; ++i) {
      $('.personal-history-list').append(await (await fetch('personalTabHistoryItem.html')).text());
    }

    //Cs
    $('.cs-tab').append(await (await fetch('csTab.html')).text());
    for (let i = 0; i < 5; ++i) {
      $('.cs-table').append(await (await fetch('csTabRow.html')).text());
    }
    for (let i = 0; i < CsTab.NUM_RECOMMENDATIONS; ++i) {
      const places = $('.cs-table-recommended-champions-cell .cs-table-cell').get();
      for (let j = 0; j < places.length; ++j) {
        if (j % 2 == 0) {
          $(places[j]).prepend(await (await fetch('csTabRecommendationItem.html')).text());
        } else {
          $(places[j]).append(await (await fetch('csTabRecommendationItem.html')).text());
        }
      }
    }
    for (let i = 0; i < CsTab.NUM_HISTORY; ++i) {
      $('.cs-table-history-cell .cs-table-cell').append(await (await fetch('csTabHistoryItem.html')).text());
    }

  }

  private async setCallbacks() {
    //Call this function once, else add .off() calls before each .on()

    //Menu navigation
    $('.side-menu-current-cs').on('click', MainWindow.selectCurrentCS);
    for (let i = 0; i < 10; ++i) {
      $($('.side-menu-old-cs')[i]).on('click', () => MainWindow.selectHistoryCS(i));
      $($('.deleteHistoryItem')[i]).on('click', event => { 
        Popup.prompt(
          "Delete history",
          "This will remove this champion select lobby from your history<br>Are you sure?", 
          () => MainWindow.deleteHistoryCS(i), 
          () => null);
        event.stopPropagation(); 
      });
    }
    $('.side-menu-add-manual-cs').on('click', () => MainWindow.selectHistoryCS(null));
    $('.s-lcu-status').on('click', MainWindow.selectPersonal);

    //Popup navigation
    $('.faqButton').on('click', async () => { 
      $('.slide-overlay').stop();
      $('.slide-overlay').animate({ left: '100%' });
      $('.slide-overlay-faq').stop();
      $('.slide-overlay-faq').animate({ left: 0 });
    });
    $('.settingsButton').on('click', async () => { 
      $('.slide-overlay').stop();
      $('.slide-overlay').animate({ left: '100%' });
      $('.slide-overlay-settings').stop();
      $('.slide-overlay-settings').animate({ left: 0 });
    });
    $('.feedbackButton').on('click', async () => { 
      $('.slide-overlay').stop();
      $('.slide-overlay').animate({ left: '100%' });
      $('.slide-overlay-feedback').stop();
      $('.slide-overlay-feedback').animate({ left: 0 });
    });
    $('.newsButton').on('click', async () => { 
      $('.slide-overlay').stop();
      $('.slide-overlay').animate({ left: '100%' });
      $('.slide-overlay-news').stop();
      $('.slide-overlay-news').animate({ left: 0 });
    });
    $('.slide-overlay-close').on('click', () => { 
      $('.slide-overlay').animate({ left: '100%' });
    });
    $('.accordeon-title').on('click', e => { 
      if ($(e.currentTarget).siblings('.accordeon-content').is(':visible')) {
        $(e.currentTarget).siblings('.accordeon-content').slideUp();
      } else {
        $('.accordeon-content').slideUp();
        $(e.currentTarget).siblings('.accordeon-content').slideDown();
      }
    });
    $('.accordeon-content').hide();
    
    $('.popupCloseButton').on('click', () => { Popup.close(); });
    $('.popup-button-yes').on('click', () => { Popup.yes(); });
    $('.popup-button-no').on('click', () => { Popup.no(); });

    $('.popup-input-text-input').on('input', () => { Popup.textChange(); });
    $('.popup-input-text-input').on('keypress', event => { if (event.key === "Enter") { Popup.yes(); event.preventDefault(); } });
    
    $('.popup-flag').on('click', event => { Popup.flagClick(event); });

    //CS
    const that = this;
    const roleSwappers = $('.cs-table-champion-swap-role').get();
    for (const i in roleSwappers) {
      const idx = Math.round(parseInt(i) % 4);
      const team = Math.floor((parseInt(i) / 4) % 2);
      const role = Math.floor(parseInt(i) / 8);
      $(roleSwappers[i]).on('click', () => that.csTab.swapRole(5 * team + role, idx + (role <= idx ? 1 : 0)));
    }

    const champSwappers = $('.cs-table-champion-swap-champion').get();
    for (const i in champSwappers) {
      const idx = Math.round(parseInt(i) % 4);
      const team = Math.floor((parseInt(i) / 4) % 2);
      const role = Math.floor(parseInt(i) / 8);
      $(champSwappers[i]).on('click', () => that.csTab.swapChampion(5 * team + role, 5 * team + idx + (role <= idx ? 1 : 0)));
    }

    const defaultSwappers = $('.cs-table-champion-swap-default').get();
    for (const i in defaultSwappers) {
      const idx = Math.round(parseInt(i) % 2);
      const team = Math.floor((parseInt(i) / 2) % 2);
      const role = Math.floor(parseInt(i) / 4);
      if (idx == 0) {
        $(defaultSwappers[i]).on('click', () => that.csTab.swapRole(5 * team + role, -1));
      } else {
        $(defaultSwappers[i]).on('click', () => that.csTab.swapChampion(5 * team + role, -1));
      }
    }

    const editIcons = $('.cs-table-edit-button').get();
    for (const i in editIcons) {
      const idx = Math.round(Math.floor((parseInt(i) + 1) / 2) % 2);
      const team = Math.floor((parseInt(i) / 2) % 2);
      const role = Math.floor(parseInt(i) / 4);

      const elm = editIcons[i]
      $(elm).parent().on('mouseenter', () => { if (that.csTab.getActiveManager().getCsView().editable) $(elm).show(); });
      $(elm).parent().on('mouseleave', () => $(elm).hide());
      if (idx == 0) {
        $(elm).on('click', () => that.csTab.editChampion(role + 5 * team));
      } else {
        $(elm).on('click', () => that.csTab.editSummoner(role + 5 * team));
      }
    }
    const regionEditIcon = $('.cs-region-edit-button').get(0);
    $('.cs-region').on('mouseenter', () => { if (that.csTab.getActiveManager().getCsView().editable) $(regionEditIcon).show(); });
    $('.cs-region').on('mouseleave', () => $(regionEditIcon).hide());
    $(regionEditIcon).on('click', () => that.csTab.editRegion());

    $('.cs-side-blue').on('change', () => { that.csTab.editSide(true); });
    $('.cs-side-red').on('change', () => { that.csTab.editSide(false); });

    $('.cs-queue-solo').on('change', () => { that.csTab.editQueue(true); });
    $('.cs-queue-flex').on('change', () => { that.csTab.editQueue(false); });
    
    //Personal
    $('.personal-champions-left-arrow').on('click', () => { that.personalTab.scrollChampRole(-1); });
    $('.personal-champions-right-arrow').on('click', () => { that.personalTab.scrollChampRole(1); });
    $('.personal-champions-options-sort-most-played').on('change', () => { that.personalTab.setSortByMostPlayed(true); });
    $('.personal-champions-options-sort-score').on('change', () => { that.personalTab.setSortByMostPlayed(false); });
    $('.personal-champions-options-performance-solo-queue').on('change', () => { that.personalTab.setSoloQueue(true); });
    $('.personal-champions-options-performance-flex').on('change', () => { that.personalTab.setSoloQueue(false); });

    $('.personal-history-left-arrow').on('click', () => { that.personalTab.scrollCscHistory(-1); });
    $('.personal-history-right-arrow').on('click', () => { that.personalTab.scrollCscHistory(1); });
    $('.personal-history-options-score-pre-game').on('change', () => { that.personalTab.setCscHistoryPreGame(true); });
    $('.personal-history-options-score-in-game').on('change', () => { that.personalTab.setCscHistoryPreGame(false); });

    const historyElems = $('.personal-history-table-container').get();
    for (const i in historyElems) {
      $(historyElems[i]).on('click', () => { that.personalTab.showCscHistoryCs(parseInt(i)); });
    }

    $('.personal-graph-canvas').on('mousemove', e => { that.personalTab.mouseOverCanvas(e); });
    $('.personal-graph-canvas').on('mouseleave', () => { that.personalTab.mouseLeaveCanvas(); });

    //Global
    $('.drags-window').each((index, elem) => { this.setDrag(elem); });
    $('.closeButton').on('click', async () => { overwolf.windows.sendMessage(windowNames.background, 'close', '', () => {}); });
    $('.minimizeButton').on('click', () => { this.window.minimize(); });
    $('.rateApp').on('click', () => { overwolf.utils.openStore({ page:overwolf.utils.enums.eStorePage.ReviewsPage, uid:"ljkaeojllenacnoipfcdpdllhcfndmohikaiphgi"}); });

    $('body').on('keyup', e => { if (e.key === "Escape") {
      MainWindow.activity();
      Popup.close();
      $('.slide-overlay').animate({ left: '100%' });
    } });
    $('body').on('mousedown', () => MainWindow.activity());
    $('.tooltip').on('mouseenter', e => that.repositionOverflowingPopup(e.currentTarget));
  }

  //Make callbacks static since the 'this' is confusing to pass to a callback, use MainWindow.instance() instead
  public static selectCurrentCS() {
    const main = MainWindow.instance();
    if (!main.csTab.hasBeenInCS) return;
    if (main.selectedView == 'lcu') return;
    MainWindow.clearAll();

    main.selectedView = 'lcu';
    main.csTab.swapToLcu();
    main.csTab.show();

    $('.side-menu-current-cs').addClass('side-menu-selected-effect');
  }

  public static async selectHistoryCS(i: number) {
    const main = MainWindow.instance();
    if (null == i) {
      main.csTab.addManualCs();
      i = 0;
    } else if (main.selectedView == 'hist' + i) return;

    {
      //Hack for better percieved responsiveness, the swapToManual takes some noticeable time and we want feedback from the menu before that time
      $($('.side-menu-old-cs')[i]).addClass('side-menu-selected-effect');
      await Timer.wait(1);
    }

    MainWindow.clearAll();
    main.selectedView = 'hist' + i;
    main.csTab.swapToManual(i);
    main.csTab.show();
    $($('.side-menu-old-cs')[i]).addClass('side-menu-selected-effect');
  }

  public static deleteHistoryCS(i: number) {
    const main = MainWindow.instance();

    main.csTab.deleteCSHistory(i);

    if (main.selectedView.startsWith('hist')) {
      let currI = parseInt(main.selectedView.substring('hist'.length));
      if (currI > i) currI--;
      else if (currI == i) currI = Math.min(currI, main.csTab.getCSHistoryLength() - 1);
      main.selectedView = '';
      if (currI >= 0) MainWindow.selectHistoryCS(currI);
      else MainWindow.selectHome();
    }
  }

  public static selectPersonal() {
    const main = MainWindow.instance();
    if (main.selectedView == 'personal') return;
    if (!main.personalTab.readyToBeDisplayed()) {
      Popup.message('LoL disconnected', 'CSC wasn\'t able to connect to the League of Legends app. Try restarting <u>League of Legends</u>.');
      return;
    }
    MainWindow.clearAll();

    main.selectedView = 'personal';
    main.personalTab.show();
    $('.s-lcu-status').addClass('s-lcu-status-selected');
  }

  public static selectStatic(csView: any) {
    const main = MainWindow.instance();
    MainWindow.clearAll();
    main.selectedView = 'static';

    main.csTab.show();
    main.csTab.swapToStatic(csView);
  }

  public static selectHome() {
    MainWindow.clearAll();
    $('.home-tab').show();
  }

  public static clearAll() {
    const main = MainWindow.instance();
    main.personalTab.hide();
    main.csTab.hide();
    main.selectedView = '';

    $('.home-tab').hide();
    $('.slide-overlay').animate({ left: '100%' });
    $('.side-menu-current-cs').removeClass('side-menu-selected-effect');
    $('.side-menu-selected-effect').removeClass('side-menu-selected-effect');
    $('.s-lcu-status').removeClass('s-lcu-status-selected');
  }

  public async submitFeedback() {
    try {
      const name = (<string>$('#feedback-name').val()).trim();
      const contact = (<string>$('#feedback-contact').val()).trim();
      const msg = (<string>$('#feedback-message').val()).trim();
      $('#feedback-name').attr("disabled", "disabled");
      $('#feedback-contact').attr("disabled", "disabled");
      $('#feedback-message').attr("disabled", "disabled");
  
      if (name.length == 0 || msg.length == 0) {
        $('.feedback-error').html('Please fill in the fields');
        $('.feedback-error').hide();
        $('.feedback-error').fadeIn();
        return;
      }
      const data = {
        name,
        contact,
        msg,
        summoner: '',
        region: '',
      };
      try {
        const nameRegion = await Lcu.getCurrentNameAndRegion();
        if (nameRegion && nameRegion.name && nameRegion.region) {
          data.summoner = nameRegion.name;
          data.region = nameRegion.region;
        }
      }catch{}

      if (!(await Aws.feedback(JSON.stringify(data)))) {
        $('.feedback-error').html('Unable to connect to the feedback server');
        $('.feedback-error').hide();
        $('.feedback-error').fadeIn();
        return;
      }

      $('.submitFeedback').hide();
      $('.feedback-success').html('Thank you for your feedback!');
      $('.feedback-success').hide();
      $('.feedback-success').fadeIn();
      $('.feedback-error').html('');
    }catch (ex) {
      $('.feedback-error').html('An unknown error occurred');
      $('.feedback-error').hide();
      $('.feedback-error').fadeIn();
      console.log(ex); //OK ON PROD
    } finally {
      $('#feedback-name').removeAttr("disabled");
      $('#feedback-contact').removeAttr("disabled");
      $('#feedback-message').removeAttr("disabled");
    }


  }

  public static async setStatus(statusJSON: string) {
    const status = JSON.parse(statusJSON) || {};
    if (status.announcement && status.announcement.length > 0) {
      $('.announcement-scrolling-text-slider').html(status.announcement);
      $('.announcement-scrolling-text-tooltip').html(status.announcement);
      $('.announcement-scrolling-text').show();

      if (MainWindow.lastStatusPopup != status.announcement) {
        MainWindow.lastStatusPopup = status.announcement;
        // Popup.message('Announcement', status.announcement);
      }

    } else {
      $('.announcement-scrolling-text').hide();
    }
    status.minVersion;
  }


  public async getWindowState() {
    return await this.window.getWindowState();
  }
  
  private async setDrag(elem: HTMLElement) {
    this.window.dragMove(elem);
  }


  
}

MainWindow.instance().run();