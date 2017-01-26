// APPJS START
$(function() {
console.groupCollapsed('INIT app');
var AppState = Backbone.Model.extend({
    defaults: {
        token: '',
        page: '',
        query: undefined,
        viewedUser: undefined
    }
});
window.appState = new AppState();
console.log('init appState',appState.toJSON());

window.serviceState = {
    tags: {
        map:{},
        list:[],
        remap:{}
    },
};
console.log('init serviceState',serviceState);


appState.on('change:token', function() {
    var token = appState.get('token');
    console.log('changed token='+token)
    
    if (token) this.trigger('login');
});

appState.on('login',function() {
    console.groupCollapsed('appState:login');
    console.log('Get Tags request');
    apireq('GET','gettags')
        .done(function(data) {
            console.groupCollapsed('AJAX done gettags:');
            console.log(data);
            var map = {};
            var list = [];
            var remap = {};
            for (var i in data.tags) {
                map[data.tags[i].name.toLowerCase()] = data.tags[i].id;
                remap[data.tags[i].id] = data.tags[i].name.toLowerCase();
                list.push(data.tags[i].name.toLowerCase());
            };
            console.log('map', map,', list', list, ', remap', remap);
            _.extend(serviceState.tags,{map:map, list:list, remap:remap});
            console.log('new serviceState',serviceState);
            console.groupEnd();
        })
        .fail(function(jqXHR, textStatus) {
            throw Error('AJAX fail gettags:',textStatus, jqXHR);
        });
    console.groupEnd();
});

appState.on('logout',function() {
    console.groupCollapsed('appState:logout');
    this.set('token', null);
    Cookies.remove('token');
    console.log('Cookies token cleared',Cookies.getJSON());
    window.close(); // сработает только в редки случаях, когда страница открыта программно
    console.log('window "closed" (:');
    router.navigate('401', {trigger:true});
    console.groupEnd();
});

appState.on('search',function(query) {
    console.groupCollapsed('appState:search',query);
    this.set('query',query);
    router.navigate('search:'+query, {trigger:true});
    console.groupEnd();
});

var AppRouter = Backbone.Router.extend({
    routes: {
        "401": "page401",
        "404": "page404",
        "auth::token": "auth",
        "page-auth::token": "auth",
        "favorites": "favorites",
        "search": "search",
        "search::query": "search",
        "profile": "profile",
        "profile::viewedUser": "profile",
        "*notFound": "default"
    },

    default: function() {
        console.warn('ROUTE: default');
        this.navigate('404', {trigger:true, replace:true});
    },

    page401: function() { 
        console.groupCollapsed('ROUTE: page401');
        appState.trigger('pageChange');
        appState.set('page','page401');
        appState.trigger('navigate');
    },

    page404: function() { 
        console.groupCollapsed('ROUTE: page404');
        appState.trigger('pageChange');
        var token = appState.get('token');
        console.log('token=\''+token+'\'');
        if (token) {
            appState.set('page','page404');
            appState.trigger('navigate');
        } else {
            this.navigate('401', {trigger:true, replace:true});
        }  
    },

    auth: function(token) {
        console.groupCollapsed('ROUTE: auth',token);
        appState.trigger('pageChange');
        Cookies.set('token',token, { expires: 365 });
        appState.set({token: token});
        this.navigate('profile', {trigger:true, replace:true});
    },

    favorites: function() {
        console.groupCollapsed('ROUTE: favorites');
        appState.trigger('pageChange');
        appState.set('page','favorites');
        appState.trigger('navigate');
    },
    search: function(query) {
        console.groupCollapsed('ROUTE: search:',query);
        appState.trigger('pageChange');
        appState.set({page:'search', query:query});
        appState.trigger('navigate');
    },
    profile: function(viewedUser) {
        console.groupCollapsed('ROUTE: profile:',viewedUser);
        appState.trigger('pageChange');
        appState.set({page:'profile', viewedUser:viewedUser});
        appState.trigger('navigate');
    },
});
var router = new AppRouter;

var Menu = Backbone.View.extend({
    panel: $('#content'),
    toggle: $('.toggle-menu'),

    initialize: function () {
        console.log('INIT Menu')
        this.model.on('change:page', this.render, this);
        
        var slideout = new Slideout({
            'panel': this.panel.get(0),
            'menu': this.$el.get(0),
            'padding': 256,
            'tolerance': 70
        });

        this.$('.menu__item').click(function() {
            slideout.close();
        });

        this.toggle.click(function () {
            slideout.toggle();
        });

        this.model.on('pageChange', function() {
            slideout.close();
        });
    },

    render: function () {
        console.log('RENDER Menu');
        var state = this.model.get("page");
        if (state === 'page401')
            this.$('li:has(.menu__item)').remove();
        return this;
    }
});
var menu = new Menu({ model: appState, el: $("#menu").get(0) });

var Page = Backbone.View.extend({
    templates: {
        "page401": _.template($('#page401').html()),
        "page404": _.template($('#page404').html()),
    },
    pages: {
        "favorites": pageFavorites,
        "search": pageSearch,
        "profile": pageProfile,
    },
    loader: $('#loader'),

    initialize: function () {
        console.log('INIT Page')
        var self = this;
        _.forEach(this.templates,function(template,name) {
            $('#'+name).remove();
        });
        _.forEach(this.pages,function(page,name) {
            self.pages[name] = page(self.el);
        });
        this.model.on('navigate', this.render, this);
        this.model.on('pageRender', this.hideLoader, this);
        this.model.on('pageChange', this.showLoader, this);
    },

    hideLoader: function () {
        $(this.loader).hide();
    },

    showLoader: function () {
        $(this.loader).show();
    },

    render: function () {
        console.log('RENDER Page');
        var page = this.model.get("page");
        var previous = this.model.previous("page");
        if (_.has(this.templates, page)) {
            this.$el.html(this.templates[page](this.model.toJSON()));
        } else if(_.has(this.pages, page)) {
            if (previous && this.pages[previous]) {
                this.pages[previous].hide();
                this.$el.html('');
            }
            this.pages[page].show();
        } else {
            throw Error('Page ['+page+'] is not defined');
        }
        
        return this;
    }
});
var page = new Page({ model: appState, el: $("#page").get(0) });

var initToken = Cookies.get('token');
console.log('initToken='+initToken);
if (initToken) appState.set('token', initToken);

Backbone.history.start();
console.log('Backbone.history.start()')

console.log('new appState',appState.toJSON());
console.groupEnd();
});
// APPJS END
