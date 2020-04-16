import {Component, ElementRef, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import {IonContent, NavController, Platform} from '@ionic/angular';
import {
  ACF_FC_LAYOUT, APP_PAGES,
  PURPOSE,
  SITE_URLS,
  STORAGE_GET_DATA,
  USER_TYPES,
  VARS
} from '../../app-constants.service';
import {HelperService} from '../../Services/Helper/helper.service';
import _ from 'lodash';
import {FormGroup} from '@angular/forms';
import {INPUT_TYPE_NAME} from '../../keyOf';
import {AuthService} from '../../core/auth/auth.service';
import {ApiService} from '../../Services/api/api.service';
import {ModalService} from '../../Services/modal/modal.service';
import {StaticService} from '../../Services/static/static.service';

@Component({
  selector: 'app-steps',
  templateUrl: './steps.page.html',
  styleUrls: ['./steps.page.scss']
})
export class StepsPage implements OnInit, OnDestroy {
  @ViewChild(IonContent, {static: false}) scrollArea: IonContent;
  _: any = _; AFL = ACF_FC_LAYOUT; SI = SITE_URLS; _UT = USER_TYPES; timeframe: any = [];
  _USER: any; userType: any;
  data: any; pStep = 0; totalFieldCount = 0; viewInit = false;
  displayRepeater = false; displayRepeaterArr: any = [];
  isLogin = false;
  loginForm: FormGroup; lFormC: any;
  registerForm: FormGroup; rFormC: any;
  sf: FormGroup; sfc: any;
  postData: any = {
    scopeMargin: 0,
    projectPrice: 0,
    projectId: 0,
    agentToken: 0
  };
  headerOptions: any; selectedClient: any; hardWareBackBtn: any;
  constructor(private activatedRoute: ActivatedRoute,
              private router: Router,
              private navCtrl: NavController,
              private el: ElementRef,
              private auth: AuthService,
              private api: ApiService,
              private modalService: ModalService,
              public helper: HelperService,
              private platform: Platform) {
    this.auth.authState$.subscribe(state => {
      if (state === true) {
        this.auth.getSavedUser().then((user) => {
          this.setUser(user);
        }).catch(() => {});
      } else {
        this._USER = this.userType = null;
      }
    });
    this.setValues();
    this.loginForm =  StaticService.getLoginForm();
    this.registerForm = StaticService.getStepRegisterForm();
    this.lFormC = this.loginForm.controls;
    this.rFormC = this.registerForm.controls;
  }
  setUser(cUser) {
    if (cUser) {
      this._USER = cUser;
      this.userType = StaticService.getUser(this._USER, STORAGE_GET_DATA.USER_ROLE);
      this.data.userId = StaticService.getUser(this._USER, STORAGE_GET_DATA.USER_ID);
      this.sf = StaticService.getQuotesForm(this.userType);
      this.sfc = this.sf.controls;
      if (StaticService.userTypeCC(this.userType)) {
        this.setFVT(this.sfc, 'projectClient', this.data.userId);
      }
      StaticService.setFormVal(this.sfc, 'projectTimeframe', this.timeframe[0].timeframe || null);
    }
  }
  setValues() {
    this.activatedRoute.queryParams.subscribe(async () => {
      const routParams = this.router.getCurrentNavigation().extras.state;
      if (routParams) {
        this.data = routParams.data;
        this.timeframe = routParams.timeframe;
        this.setUser(routParams.cUser);
        this.totalFieldCount = _.toNumber(this.data.acf.quote_fields.length);
        _.forEach(this.data.acf.quote_fields, v => {
          const thisLayout = v.acf_fc_layout;
          if (_.includes([ACF_FC_LAYOUT.FIELDS, ACF_FC_LAYOUT.EXCLUSIONS, ACF_FC_LAYOUT.STYLES], thisLayout)) {
            _.forEach(v.fields, vf => {
              if (vf.quantity && vf.checked === 'yes') {
                vf.isSelected = _.toInteger(vf.default_quantity);
              }
            });
          }
          switch (thisLayout) {
            case ACF_FC_LAYOUT.WIDTH_AND_HEIGHT: {
              v.wh_width = v.wh_height = 3;
              break;
            }
            case ACF_FC_LAYOUT.WIDTH_AND_LENGTH: {
              v.wl_width = v.wl_length = 3;
              break;
            }
            case ACF_FC_LAYOUT.PRICE_AND_AREA: {
              v.pa_price = 30; v.pa_area = 0;
              break;
            }
            case ACF_FC_LAYOUT.ROOM_SIZE: {
              v.rs_width = v.rs_length = 3; v.rs_height = 2.7;
              break;
            }
            case ACF_FC_LAYOUT.LENGTH: {
              v.l_length = 3;
              break;
            }
            case ACF_FC_LAYOUT.AREA: {
              v.a_area = 50;
              break;
            }
            case ACF_FC_LAYOUT.HEIGHT: {
              v.h_height = 2.7;
              break;
            }
            case ACF_FC_LAYOUT.EXCLUSIONS: {
              // if (!(this._USER && (this.userType === USER_TYPES.HEAD_CONTRACTOR || this.userType === USER_TYPES.AGENT))) {
              if (!(StaticService.userTypeHA(this.userType))) {
                this.data.acf.quote_fields = _.filter(this.data.acf.quote_fields, (rv) => {
                  return (rv.acf_fc_layout !== ACF_FC_LAYOUT.EXCLUSIONS);
                });
                this.totalFieldCount--;
              }
              break;
            }
            default: {
              break;
            }
          }
        });
        this.displayRepeater = !!((this.data.acf.display_repeater[0] === 'Yes') && StaticService.userTypeHAS(this.userType));
        if (this.displayRepeater) {
          this.totalFieldCount++;
          this.data.acf.quote_fields.push({
            acf_fc_layout: 'display_repeater',
            title: 'Add manual items',
            slug: 'display_repeater',
            description: 'This is where you can add manual items to your quote, this is for project specific scope that you haven\'t created options for. All totals will be added to the grand total.'
          });
          this.repeaterItem();
          this.helper.toggleShowHide(this.displayRepeaterArr, this.displayRepeaterArr[0]);
        }
        this.headerOptions = {
          isProjectName: true,
          canEditProjectName: true,
          isProgressBar: true,
          projectName: this.data.title.rendered,
          progress: ((this.pStep + 1) / this.totalFieldCount)
        };
      }
    });
  }
  vCheck(fieldName, type: INPUT_TYPE_NAME = 'OTHER', options: any = {}) {
    options.isRequired = true;
    const cFormC = !(this._USER) ? (this.isLogin ? this.lFormC : this.rFormC) : (this.sfc);
    if (cFormC) { return StaticService.formError(cFormC, fieldName, type, options).msg; }
  }
  setFVT(formC, key, value) {
    if (formC) {
      StaticService.setFormVal(formC, key, value);
    }
  }
  ngOnInit() {
    this.platform.ready().then(() => {
      this.hardWareBackBtn = this.platform.backButton.subscribeWithPriority(9999, async () => {
        this.onStep('setRoot');
      });
      setTimeout(() => {
        console.log('sss');
        this.scrollArea.scrollToBottom(100);
      }, 100);
    });
  }
  ngOnDestroy() {
    try {
      this.hardWareBackBtn.unsubscribe();
    } catch (e) { }
  }
  calPrice() {
    // this.api.cancelRequest();
    setTimeout(() => {
      const data = this.data;
      data.displayRepeaterArr = this.displayRepeaterArr;
      const postData = this.postData;
      postData.projectName = this.headerOptions.projectName;
      postData.templateId = data.id;
      _.forEach(postData, (val, key) => {
        data[key] = val;
      });
      this.api.apiCall(PURPOSE.CALCULATE_PRICE, {data}, false, false).then((res: any) => {
        if (ApiService._successRes(res)) {
          this.postData.projectPrice = res.data;
        }
      }).catch(() => {});
    }, 0);
  }
  onHeadBtnTrigger(e) {
    if (e) {
      if (e.returnType === '_LOGO') {
        this.onStep('setRoot');
      }
    }
  }
  onStep(nav = null) {
    if (nav === 'back' || nav === 'setRoot') {
      if (!this.pStep || nav === 'setRoot') {
        this.helper.presentAlertConfirm('Are you sure you want to leave?', 'All quote data will be lost', 'Leave', 'Resume').then(isConfirm => {
          if (isConfirm) {
            this.helper.pushRootPage(APP_PAGES.ESTIMATE, {selectedTab: 'Estimate'});
          }
        });
      } else {
        this.pStep--;
        this.headerOptions.progress = ((this.pStep + 1) / this.data.acf.quote_fields.length);
      }
    } else {
      this.pStep++;
      this.headerOptions.progress = ((this.pStep + 1) / this.data.acf.quote_fields.length);
    }
    this.calPrice();
  }
  oBj(isFiled = true, fields = 'fields') {
    return isFiled ? this.data.acf.quote_fields[this.pStep][fields] : this.data.acf.quote_fields[this.pStep];
  }
  itemSelect(i, type = 'inc', fields = 'fields') {
    if (this.oBj(false, fields).type_of_fields === 'Radio' && !this.oBj()[i].quantity) {
      _.forEach(this.oBj(), v => {
        v.isSelected = false;
      });
      this.oBj()[i].isSelected = !this.oBj()[i].isSelected;
    } else {
      if (type === 'img') {
        if (this.oBj()[i].checked === 'yes') {
          this.oBj()[i].isSelected = (this.oBj()[i].isSelected > 0) ? 1 : (_.toInteger(this.oBj()[i].isSelected) + _.toInteger(this.oBj()[i].default_quantity));
        } else {
          this.oBj()[i].isSelected = (this.oBj()[i].isSelected > 0) ? 0 : (_.toInteger(this.oBj()[i].isSelected) + 1);
        }
        // this.oBj()[i].isSelected = (this.oBj()[i].isSelected > 0) ? 0 : (_.toInteger(this.oBj()[i].isSelected) + 1);
      } else if (type === 'inc') {
        this.oBj()[i].isSelected = _.toInteger(this.oBj()[i].isSelected) + 1;
      } else if (type === 'dec') {
        if (this.oBj()[i].checked === 'yes') {
          this.oBj()[i].isSelected = (this.oBj()[i].isSelected > 2) ? (_.toInteger(this.oBj()[i].isSelected) - 1) : 1;
        } else {
          this.oBj()[i].isSelected = (this.oBj()[i].isSelected > 1) ? (_.toInteger(this.oBj()[i].isSelected) - 1) : 0;
        }
        // this.oBj()[i].isSelected = (this.oBj()[i].isSelected > 1) ? (_.toInteger(this.oBj()[i].isSelected) - 1) : 0;
      } else if (type === 'toggle') {
        this.oBj(true, fields)[i].isSelected = !this.oBj(true, fields)[i].isSelected;
      }
    }
    this.calPrice();
  }
  repeaterItem(i = 0, type = 'add') {
    if (type === 'remove') {
      if (this.displayRepeaterArr.length > 1) {
        this.displayRepeaterArr = _.filter(this.displayRepeaterArr, (val, key) => {
          return (key !== i);
        });
      }
    } else {
      this.displayRepeaterArr.push({ customQuoteFieldTitle: '' });
    }
  }
  changeLoginView(view = 'Login') {
    if (view === 'Login') {
      this.registerForm.reset();
    } else if (view === 'Register') {
      this.loginForm.reset();
    }
    this.isLogin = !this.isLogin;
  }
  saveDetails() {
    this.data.displayRepeaterArr = this.displayRepeaterArr;
    this.postData.projectName = this.headerOptions.projectName;
    this.postData.templateId = this.data.id;
    _.forEach(this.postData, (val, key) => {
      this.data[key] = val;
    });
    this.data.api_key = VARS.API_KEY;
    this.data.purpose = 'save_quote';
    if (this._USER) {
      const invalidElements = this.el.nativeElement.querySelectorAll('.ng-invalid');
      StaticService.markFormGroupTouched(this.sf, invalidElements);
      if (this.sf.valid) {
        _.forEach(this.sf.value, (val, key) => {
          if (key === 'date_start') {
            val = this.helper.getCDT('YYYY/MM/DD', this.sf.value.date_start);
          }
          this.data[key] = val;
        });
        console.log('this.data', this.data);
        this.helper.presentLoadingWithOptions('Saving data...').catch(() => {});
        this.api.apiCall(PURPOSE.SAVE_QUOTE, this.data).then((saveRes: any) => {
          if (ApiService._successRes(saveRes)) {
            this.navCtrl.navigateRoot(APP_PAGES.JOBS, {state: {detailJobId: saveRes.data.projectId, selectedTab: 'Jobs' }}).catch(() => {});
          }
          this.helper.dismissLoading();
        }).catch(() => {});
      }
    } else {
      const invalidElements = this.el.nativeElement.querySelectorAll('.ng-invalid');
      const cForm = this.isLogin ? this.loginForm : this.registerForm;
      const purpose = this.isLogin ? PURPOSE.APP_LOGIN : PURPOSE.APP_REGISTER;
      StaticService.markFormGroupTouched(cForm , invalidElements);
      if (cForm.valid) {
        this.api.login(purpose, cForm.value, this.isLogin, true).then((status) => {
          if (status) { this.changeLoginView(); }
        }).catch(() => {});
      } else {
        StaticService.markFormGroupTouched(cForm , invalidElements);
      }
    }
  }
  addClient() {
    this.modalService.openModal('addNewClient', 'Create new client', {}, 'defaultModal');
  }
}
